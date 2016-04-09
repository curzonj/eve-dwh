#!/usr/bin/env node

'use strict';

const logfmt = require('logfmt')
const rp = require('request-promise')
rp.errors = require('request-promise/errors')
const util = require('util')
const moment = require('moment')
const bluebird = require('bluebird')
const bluebirdThrottle = require('promise-throttle')
const lib = require('../src/library')
const sql = require('../src/sql')
const debug = require('../src/debug')
const pubsub = require('../src/pubsub')
const uuidGen = require('node-uuid')
const stats = require('../src/metrics').stats
const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const errors = require('../src/errors')

lib.setupSignalHandlers()

const eveThrottle = new bluebirdThrottle({
  requestsPerSecond: parseInt(process.env.EVE_API_RATELIMIT || 10),
  promiseImplementation: bluebird,
})
const base_url = process.env.CREST_API_BASE_URL
const serverErrorDelay = 500
const daily_insert_sql = fs.readFileSync(path.join(__dirname, '../doc') + '/daily_stats_insert.sql', 'utf8')

function bidRangeToInt(range) {
  switch (range) {
    case 'station':
      return -1
      break;
    case 'solarsystem':
      return 0
      break;
    case 'region':
      return 32767
      break;
    default:
      return parseInt(range)
      break;
  }
}

const orderConcurrency = parseInt(process.env.ORDER_RATELIMIT || 10) / 10
_.times(orderConcurrency, function(n) {
  lib.pollingLoop(function market_orders() {
    const logger = logfmt.namespace({
      fn: 'crest_poller.js#market_orders',
      loop: uuidGen.v1(),
      worker: n,
    })
    const timer = logger.time()

    return sql.transaction(function(trx) {
      return trx.raw(
        'update market_polling a0 set order_polling_started_at = now() from (select type_id, region_id from market_polling where orders_next_polling_at < now() AND order_polling_started_at < (now() - interval \'30 seconds\') order by orders_polling_interval asc limit ? for update skip locked) as a1 where a0.type_id = a1.type_id and a0.region_id = a1.region_id returning a0.type_id, a0.region_id, a0.orders_polling_override', [10]
      ).then(function(res) {
        return res.rows /* force knex to execute the query */
      })
    }).
    then(function(rows) {
      logger.log({
        at: 'start',
        rows_available: rows.length,
      })

      if (rows.length > 0) {
        return bluebird.map(rows, function(row) {
          return importSingleOrderType(row.type_id, row.region_id, logger).then(function() {
            if (row.orders_polling_override !== null)
              pubsub.emit('my_order_polling', {
                region_id: row.region_id,
                type_id: row.type_id,
              })
          })
        }).then(function() {
          return false
        })
      } else {
        return true
      }
    }).tap(function() {
      timer.log({
        at: 'finished',
      })
    }).catch(function(e) {
      logger.error(e)

      // If we hit an error, take a break
      return true
    })
  })
})

// Most of the request rate is for order updating
var historyConcurrency = parseInt(process.env.HISTORY_RATELIMIT || 5)
var historyThrottle = new bluebirdThrottle({
  requestsPerSecond: historyConcurrency,
  promiseImplementation: bluebird,
})

lib.pollingLoop(function() {
  const logger = logfmt.namespace({
    fn: 'crest_poller.js#order_histories',
    loop: uuidGen.v1(),
  })
  const timer = logger.time()

  return sql.transaction(function(trx) {
    return trx.raw(sql('market_polling').whereRaw('history_next_polling_at < current_timestamp').orWhereNull('history_next_polling_at').orderBy('history_polling_interval', 'asc').limit(historyConcurrency).toString() + ' FOR UPDATE SKIP LOCKED').then(function(result) {
      logger.log({
        at: 'start',
        rows_available: result.rowCount,
      })

      if (result.rowCount > 0) {

        return bluebird.map(result.rows, function(row) {
          return historyThrottle.add(function() {
            return importSingleHistory(row.type_id, row.region_id).then(function() {
              return trx('market_polling').
              where({
                type_id: row.type_id,
                region_id: row.region_id,
              }).
              update('history_next_polling_at', sql.raw('current_timestamp + history_polling_interval'))
            })
          })
        }).then(function() {
          return false
        })
      } else {
        return true
      }
    })
  }).tap(function() {
    timer.log({
      at: 'finished',
    })
  }).catch(function(e) {
    logger.error(e)

    // If we hit an error, take a break
    return true
  })
})

const eveRequestPool = {
  maxSockets: 20,
}
function eveRequest(url) {
  return bluebird.try(function() {
    return eveThrottle.add(function() {
      var timer = stats.timer('crest_request').start()
      debug('eve:crest', {
        url: url,
        at: 'start',
      })

      return bluebird.resolve(rp({
        uri: base_url + url,
        forever: true,
        pool: eveRequestPool,
        headers: {
          'User-Agent': process.env.CONTACT_STRING,
        },
        json: true,
      })).tap(function() {
        debug('eve:crest', {
          at: 'finished',
          url: url,
          elapsed: timer.end(),
        })
      }).catch(rp.errors.RequestError, function(e) {
        logfmt.log({
          fn: 'eveRequest',
          at: 'error',
          url: url,
          message: e.message,
          elapsed: timer.end(),
        })
        stats.meter('crest_errors').mark()

        return bluebird.delay(serverErrorDelay).then(function() {
          return eveRequest(url)
        })
      }).catch(rp.errors.StatusCodeError, function(e) {
        var message
        try {
          message = e.error.message
        } catch (e2) {
          message = JSON.stringify(e.error)
        }

        logfmt.log({
          fn: 'eveRequest',
          at: 'error',
          url: url,
          status_code: e.statusCode,
          message: message,
          elapsed: timer.end(),
        })
        stats.meter('crest_errors').mark()

        if (e.statusCode > 499) {
          return bluebird.delay(serverErrorDelay).then(function() {
            return eveRequest(url)
          })
        } else {
          throw e
        }
      })
    })
  })
}

function getCrestHistory(type_id, region_id) {
  return eveRequest(util.format('/market/%d/types/%d/history/', region_id, type_id)).
  catch(rp.errors.StatusCodeError, function(e) {
    if (e.statusCode === 404) {
      return {
        items: [],
      }
    } else {
      throw e
    }
  })
}

function getLatestHistoryDate(type_id, region_id) {
  return sql('market_history').max('history_date').where({
    type_id: type_id,
    region_id: region_id,
  }).then(function(rows) {
    if (rows.length > 0)
      return rows[0].max
  })
}

function importSingleHistory(type_id, region_id) {
  return bluebird.all([
    getCrestHistory(type_id, region_id),
    getLatestHistoryDate(type_id, region_id),
  ]).spread(function(data, most_recent_result) {
    var daysago2 = moment().subtract(1, 'days')

    return bluebird.map(data.items, function(r) {
      var date = lib.parseUTC(r.date)
      var m_date = moment(date)

      if ((most_recent_result === null || m_date.isAfter(most_recent_result)) && m_date.isBefore(daysago2)) {
        return sql.raw(sql('market_history').insert({
          type_id: type_id,
          region_id: region_id,
          history_date: date,
          orders: r.orderCount,
          quantity: r.volume,
          low: r.lowPrice,
          high: r.highPrice,
          average: r.avgPrice,
        }).toString() + ' ON CONFLICT (type_id, region_id, history_date) DO NOTHING')
      } else {

      }
    }, {
      concurrency: 10,
    })
  })
}

function importSingleOrderType(type_id, region_id, logger) {
  var now = new Date()
  return getAllCrestOrders(type_id, region_id).spread(function(sell_orders, buy_orders) {
    return sql.transaction(function(trx) {
      return trx('market_polling').where({
        type_id: type_id,
        region_id: region_id,
      }).forUpdate().then(function() {
        return trx('market_orders').where({
          type_id: type_id,
          region_id: region_id,
        }).forUpdate()
      }).tap(sql.utils.parseNumbers).then(function(orders) {
        const change_stats = {
          buy_orders_price_chg: 0,
          buy_orders_vol_chg: 0,
          buy_orders_disappeared: 0,
          buy_units_vol_chg: 0,
          buy_units_disappeared: 0,
          buy_price_wavg_sold: 0,
          buy_price_min_sold: 0,
          buy_price_max_sold: 0,
          new_buy_order_units: 0,
          new_sell_order_units: 0,
          sell_orders_price_chg: 0,
          sell_orders_vol_chg: 0,
          sell_orders_disappeared: 0,
          sell_units_vol_chg: 0,
          sell_units_disappeared: 0,
          sell_price_wavg_sold: 0,
          sell_price_min_sold: 0,
          sell_price_max_sold: 0,
          new_sell_orders: 0,
          new_buy_orders: 0,
          buy_sold: [],
          sell_sold: [],
        }
        const change_stats_by_station = {}


        function incrementStats(station_id, key, count) {
          if (count === undefined)
            count = 1
          if (change_stats_by_station[station_id] === undefined) {
            change_stats_by_station[station_id] = _.assign({}, change_stats)
            change_stats_by_station[station_id].buy_sold = []
            change_stats_by_station[station_id].sell_sold = []
          }

          change_stats_by_station[station_id][key] = change_stats_by_station[station_id][key] + count
        }

        function storeSold(station_id, side, units, price) {
          change_stats_by_station[station_id][side + '_sold'].push({
            units: units,
            price: price,
          })
        }

        function importItem(o) {
          var buy_sell = o.buy ? 'buy' : 'sell'
          var row = _.find(orders, {
            id: o.id,
          })
          var issueDate = lib.parseUTC(o.issued)

          if (row === undefined) {
            return bluebird.try(function() {
              return trx('market_orders').insert({
                id: o.id,
                first_observed_at: now,
                observed_at: now,
                price: o.price,
                volume_remaining: o.volume,
                volume_entered: o.volumeEntered,
                min_volume: o.minVolume,
                buy: o.buy,
                issue_date: issueDate,
                duration: o.duration,
                range: bidRangeToInt(o.range),
                type_id: o.type.id,
                station_id: o.location.id,
                region_id: trx('staStations').select('regionID').where({
                  stationID: o.location.id,
                }),
              })
            }).then(function() {
              incrementStats(o.location.id, 'new_' + buy_sell + '_orders')
              incrementStats(o.location.id, 'new_' + buy_sell + '_order_units', o.volume)
              return null
            })
          } else if (row.volume_remaining != o.volume || moment(row.issue_date).isBefore(issueDate)) {
            const new_values = {}

            // Volume never goes back up, if it did then we have a caching issue
            // and we have received stale data.
            if (row.volume_remaining > o.volume) {
              new_values.volume_remaining = o.volume

              const volume_delta = row.volume_remaining - o.volume
              incrementStats(o.location.id, buy_sell + '_orders_vol_chg')
              incrementStats(o.location.id, buy_sell + '_units_vol_chg', volume_delta)
              storeSold(o.location.id, buy_sell, volume_delta, row.price)
            }

            if (moment(row.issue_date).isBefore(issueDate)) {
              new_values.issue_date = issueDate

              if (o.price !== row.price) {
                new_values.price = o.price
                incrementStats(o.location.id, buy_sell + '_orders_price_chg')
              }
            }

            return bluebird.try(function() {
              if (_.isEmpty(new_values)) {
                logger.log({
                  at: 'bad_order_caching',
                  prev_volume: row.volume_remaining, next_volume: o.volume,
                  prev_price: row.price, next_price: o.price,
                  prev_issue: row.issue_date, next_issue: issueDate,
                })
              } else {
                return trx('market_orders').
                  where({ id: o.id, }).
                  update(_.assign({ observed_at: now }, new_values))
              }
            }).then(function() {
              return null
            })
          } else {
            return o.id
          }
        }

        return bluebird.all([
          bluebird.map(sell_orders.items, importItem),
          bluebird.map(buy_orders.items, importItem),
        ]).spread(function(untouched_sells, untouched_buys) {
          var touch = _.compact(_.concat(untouched_sells, untouched_buys))
          return trx('market_orders').whereIn('id', touch).update({
            observed_at: now,
          })
        }).then(function() {
          var existing = _.concat(_.map(sell_orders.items, 'id'), _.map(buy_orders.items, 'id'))
          var stale_rows = _.reject(orders, function(o) {
            return _.includes(existing, o.id)
          })

          // archive old orders
          if (stale_rows.length > 0) {
            const still_active = _.filter(orders, (o) => {
              return _.includes(existing, o.id)
            })

            return bluebird.each(stale_rows, function(row) {
              const buy_sell = row.buy ? 'buy' : 'sell'

              // The disappeared order was canceled if there are any preexisting orders still
              // active that were at a better price than this one in the previous update.
              const canceled_criteria = _.filter(still_active, (o) => {
                return (
                  o.buy === row.buy && (
                    (o.buy === true && o.price > row.price) ||
                    (o.buy === false && o.price < row.price)
                  )
                )
              })
              const canceled = canceled_criteria.length > 0

              if (!canceled) {
                incrementStats(row.station_id, buy_sell + '_orders_disappeared')
                incrementStats(row.station_id, buy_sell + '_units_disappeared', row.volume_remaining)
                storeSold(row.station_id, buy_sell, row.volume_remaining, row.price)
              } else {
                debug('math:canceled', {
                  at: 'canceled',
                  order_id: row.id,
                  details: JSON.stringify(row),
                  criteria: JSON.stringify(canceled_criteria),
                })
              }
            }).then(function() {
              // delete old orders
              const stale_ids = _.map(stale_rows, 'id')
              return bluebird.all([
                trx('market_orders').whereIn('id', stale_ids).delete(),
                trx('character_order_details').whereIn('id', stale_ids).delete(),
              ])
            })
          }
        }).then(function() {
          var stationOrders = {
            buy: _.groupBy(buy_orders.items, (o) => {
              return o.location.id
            }),
            sell: _.groupBy(sell_orders.items, (o) => {
              return o.location.id
            }),
          }


          return bluebird.each(
            trx('stations_with_stats').where({ region_id: region_id }).pluck('station_id'),
          function(station_id) {
            const raw_buy_orders = stationOrders.buy[station_id] || []
            const maxBuyPrice = _.max(_.map(raw_buy_orders, 'price')) || null
            const buyOrders = _.orderBy(
              _.reject(buy_orders.items, (o) => {
                return (o.price < (maxBuyPrice / 100)) || (o.minVolume > o.volume)
              }),
              ['price', 'issued'], ['desc', 'asc']
            )
            const buyUnits = _.sum(_.map(buyOrders, 'volume'))
            const buyOrderData = _.map(buyOrders, o => { return [ o.price, o.volume ]})

            const sellOrders = _.orderBy(stationOrders.sell[station_id] || [], ['price', 'issued'], ['asc', 'asc'])
            const sellUnits = _.sum(_.map(sellOrders, 'volume'))
            const sellOrderData = _.map(sellOrders, o => { return [ o.price, o.volume ]})

            const buyOrder_count = buyOrders.length
            const sellOrder_count = sellOrders.length

            // The orders must already be properly sorted
            function transactQuantity(target, orders) {
              const acc = _.reduce(orders, (acc, o) => {
                if (acc.units >= target)
                  return acc

                var transact = Math.min((target - acc.units), o.volume)
                acc.units = acc.units + transact
                acc.price = acc.price + (transact * o.price)

                return acc
              }, {
                units: 0,
                price: 0,
              })

              return acc.price / acc.units
            }

            function priceAfterQuantity(target, orders) {
              const acc = _.reduce(orders, (acc, o) => {
                if (acc.units >= target)
                  return acc

                acc.units = acc.units + o.volume
                acc.order = o

                return acc
              }, {
                units: 0,
                order: {
                  price: null,
                },
              })

              return acc.order.price
            }

            var buy_price_wavg = (_.sum(_.map(buyOrders, (o) => {
              return o.price * o.volume
            })) / buyUnits) || null
            var buy_price_5pct = transactQuantity(Math.round(buyUnits * 0.05), buyOrders) || null
            var buy_price_median = priceAfterQuantity(Math.round(buyUnits / 2), buyOrders) || null
            var sell_price_min = _.min(_.map(sellOrders, 'price')) || null
            var sell_price_wavg = (_.sum(_.map(sellOrders, (o) => {
              return o.price * o.volume
            })) / sellUnits) || null
            var sell_price_5pct = transactQuantity(Math.round(sellUnits * 0.05), sellOrders) || null
            var sell_price_median = priceAfterQuantity(Math.round(sellUnits / 2), sellOrders) || null

            // Provide the region_id so that the request can use the index
            const local_change_stats = change_stats_by_station[station_id] || _.assign({}, change_stats)

            _.each(['buy', 'sell'], (n) => {
              var sold = local_change_stats[n + '_sold']
              delete local_change_stats[n + '_sold']

              var prices = _.map(sold, 'price')
              local_change_stats[n + '_price_wavg_sold'] = (_.sum(_.map(sold, (o) => {
                return o.price * o.units
              })) / _.sum(_.map(sold, 'units'))) || null
              local_change_stats[n + '_price_min_sold'] = _.min(prices) || null
              local_change_stats[n + '_price_max_sold'] = _.max(prices) || null
            })

            return bluebird.all([
              trx.raw(daily_insert_sql, _.assign({
                table_name: 'market_daily_stats_'+lib.datePartitionedPostfix(),
                type_id: type_id,
                station_id: station_id,
                region_id: region_id,
                date_of: now,
                stats_timestamp: Math.floor(now.getTime()/1000),
                buy_price_max: maxBuyPrice,
                buy_price_wavg: buy_price_wavg,
                buy_price_5pct: buy_price_5pct,
                buy_price_median: buy_price_median,
                buy_units: buyUnits,
                buy_orders: buyOrder_count,
                sell_orders: sellOrder_count,
                sell_price_min: sell_price_min,
                sell_price_wavg: sell_price_wavg,
                sell_price_5pct: sell_price_5pct,
                sell_price_median: sell_price_median,
                sell_units: sellUnits,
              }, local_change_stats)),
              // Provide the region_id so that the request can use the index
              trx.raw(sql('station_order_stats').insert({
                type_id: type_id,
                station_id: station_id,
                region_id: region_id,
                updated_at: sql.raw('current_timestamp'),
                buy_price_max: maxBuyPrice,
                buy_price_wavg: buy_price_wavg,
                buy_price_5pct: buy_price_5pct,
                buy_price_median: buy_price_median,
                buy_units: buyUnits,
                buy_orders: buyOrder_count,
                sell_orders: sellOrder_count,
                sell_price_min: sell_price_min,
                sell_price_wavg: sell_price_wavg,
                sell_price_5pct: sell_price_5pct,
                sell_price_median: sell_price_median,
                sell_units: sellUnits,
              }).toString() + ' ON CONFLICT (type_id, region_id, station_id) DO UPDATE SET ' +
                'buy_price_max = EXCLUDED.buy_price_max,'+
                'buy_price_wavg = EXCLUDED.buy_price_wavg,'+
                'buy_price_5pct = EXCLUDED.buy_price_5pct,'+
                'buy_price_median = EXCLUDED.buy_price_median,'+
                'buy_units = EXCLUDED.buy_units,'+
                'buy_orders = EXCLUDED.buy_orders,'+
                'sell_orders = EXCLUDED.sell_orders,'+
                'sell_price_min = EXCLUDED.sell_price_min,'+
                'sell_price_wavg = EXCLUDED.sell_price_wavg,'+
                'sell_price_5pct = EXCLUDED.sell_price_5pct,'+
                'sell_price_median = EXCLUDED.sell_price_median,'+
                'sell_units = EXCLUDED.sell_units'
              ),
            ])
          })
        })
      }).then(function() {
        return trx('market_polling').
        where({
          type_id: type_id,
          region_id: region_id,
        }).
        update('orders_next_polling_at', sql.raw('current_timestamp + orders_polling_interval'))
      }).catch(errors.fn.reportAndRaise)
    })
  })
}

function getAllCrestOrders(type_id, region_id) {
  return bluebird.all([
    getCrestOrders('sell', type_id, region_id),
    getCrestOrders('buy', type_id, region_id),
  ])
}

function getCrestOrders(side, type_id, region_id) {
  return eveRequest(util.format('/market/%d/orders/%s/?type=%s/types/%d/', region_id, side, base_url, type_id))
}
