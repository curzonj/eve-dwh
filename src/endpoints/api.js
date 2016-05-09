'use strict';

const express = require('express');
const router = express.Router();
const lib = require('../library')
const sql = require('../sql')
const errors = require('../errors')
const _ = require('lodash')
const bluebird = require('bluebird')

router.post('/sql', function(req, res) {
  var query

  switch (req.query.query) {
    case 'types':
      query = sql('invTypes').limit(10)
      break
    default:
      res.status(404).json({
        errorDetails: 'No such query',
      })
      return
  }

  query.then(function(result) {
    res.json(result)
  })
})

router.get('/v1/locations/autocomplete', (req, res, next) => {
  const query = req.query.q.replace('%', '').replace('_','') + '%'
  const markets = req.swagger.params.markets

  return bluebird.all([
    sql('mapRegions').
      where('regionName', 'ILIKE', '%'+query).
      select('regionName AS name', 'regionID'),
    bluebird.try(() => {
      var chain = sql('staStations').
        where('stationName', 'ILIKE', query).
        select('stationName AS name', 'stationID', 'regionID')

      if (markets) {
        chain = chain.whereIn('stationID', sql('station_order_stats').distinct('station_id'))
      }

      return chain
    }),
  ]).spread((regions, stations) => {
    res.json(_.concat(regions, stations))
  }).catch(next)
})

router.get('/v1/types/autocomplete', (req, res, next) => {
  const query = '%' + req.query.q.replace('%', '').replace('_','') + '%'
  const int_id = parseInt(req.query.q)

  return sql('type_metas')
    .whereRaw('NOT id_list && Array[2, 1396, 350001, 1662]') // ignore blueprints, apparel, DUST
    .where(function() {
      var chain = this.where('typeName', 'ILIKE', query)
      if (!isNaN(int_id) && int_id > 0)
        chain.orWhere('typeID', int_id)
    }).orderBy('typeID')
    //.where({ published: true })
    .select('typeName', 'typeID')
    .then(rows => {
      res.json(rows)
    }).catch(next)
})

router.get('/v1/types/:type_id/market/stats', (req, res, next) => {
  return sql('agg_market_type_stats').where({
      type_id: req.params.type_id,
      region_id: req.query.region_id,
      station_id: req.query.station_id,
    }).first().then(data => {
      res.json(data)
    }).catch(next)
})

router.get('/v1/types/:type_id/market/buy_sell_series', (req, res, next) => {
  const columns = [
    'buy_price_max',
    'buy_units',
    'sell_price_min',
    'sell_units',
  ]

  const type_id = req.params.type_id

  return bluebird.all([
    sql(sql.raw('(select history_date AS date_of, type_id, region_id, quantity, average from market_history) h'))
    .where({
      type_id: type_id,
      region_id: req.query.region_id,
      //  station_id: req.query.station_id,
    }).leftJoin(sql.raw('(select * from market_daily_stats where type_id = ? and region_id = ? and station_id = ?) m using (type_id, region_id, date_of)', [type_id, req.query.region_id, req.query.station_id]))
    .whereRaw('date_of >= current_timestamp - cast(? as interval)', ['6 months'])
    .orderBy('date_of', 'asc')
    .select('date_of', 'quantity AS region_units', 'average AS region_avg', 'day_buy_price_wavg_tx',
    'day_sell_price_wavg_tx', 'day_avg_buy_units', 'day_avg_sell_units')
    .then(data => {
      return _.map(data, row => {
        const data = {
          unix_ts: row.date_of.getTime()/1000,
          region_avg: parseFloat(row.region_avg),
          region_units: parseFloat(row.region_units),
          buy_price_wavg: parseFloat(row.day_buy_price_wavg_tx),
          buy_units: parseFloat(row.day_avg_buy_units),
          sell_price_wavg: parseFloat(row.day_sell_price_wavg_tx),
          sell_units: parseFloat(row.day_avg_sell_units),
        }

        return data
      })
    }),
    sql('market_daily_stats')
    .leftJoin(sql.raw('(select history_date AS date_of, type_id, region_id, quantity, average from market_history) h using (type_id, region_id, date_of)'))
    .whereRaw('date_of >= current_timestamp - cast(? as interval)', ['10 days'])
    .where({
      type_id: type_id,
      region_id: req.query.region_id,
      station_id: req.query.station_id,
    })
    .orderBy('date_of', 'asc')
    .select(columns).select('stats_timestamp', 'quantity AS region_units')
    .then(data => {
      return _.flatten(_.map(data, row => {
        var regional = parseFloat(row.region_units)
        return _.map(row.stats_timestamp, (value, index, col) => {
          var fake_row = { unix_ts: value, region_units: regional }
          _.forEach(columns, name => {
            fake_row[name] = parseFloat(row[name][index])
          })
          return fake_row
        })
      }))
    }),
    bluebird.try(() => {
      function priceOf(type_id) {
        return sql.raw('select * from (select date_of, day_sell_price_wavg_tx as price from market_daily_stats where type_id = :type_id and region_id = :region_id and station_id = :station_id union select history_date, average from market_history where type_id = :type_id and region_id = :region_id and history_date < (select min(date_of) from market_daily_stats where type_id = :type_id and region_id = :region_id and station_id = :station_id)) a where date_of >= current_timestamp - cast( :interval as interval) order by date_of desc', {
          type_id: type_id,
          region_id: 10000002,
          station_id: 60003760,
          interval: '6 months',
        }).then(result => result.rows)
      }

      return bluebird.all([
        sql('type_metas').where('typeID', type_id).first(),
        sql('industryActivityProducts').where('productTypeID', type_id).first('typeID')
        .then(blueprint => {
          if (blueprint === undefined)
            return

          return sql('industryActivityProbabilities').where('productTypeID', blueprint.typeID)
          .orderBy('probability', 'desc').first()
          .then(results => {
            return {
              typeID: blueprint.typeID,
              invention: results,
            }
          })
        }),
      ]).spread((type, blueprint) => {
        var category
        if (type.parent_group_id == 1332) {
          category = 'planetary' // TODO
        } else if (type.parent_group_id == 1034) {
          category = 'reactions' // TODO
        } else if (type.parent_group_id == 1922) {
          category = 'rmt' // TODO 10day chart
        } else if (_.includes(type.id_list, 1031)) {
          category = 'ore' // TODO 10day chart
        } else if (blueprint === undefined) {
          return
        } else if (type.metaGroupID == 2) {
          category = 't2'
        } else if (type.metaGroupID === null) {
          if (blueprint.invention === undefined) {
            category = 't1'
          } else {
            category = 't3' // TODO
          }
        } else {
          return
        }

        const quantities = {}
        if (blueprint !== undefined) {
          if (blueprint.invention !== undefined) {
            return // TODO
          }

          return sql('industryActivityMaterials')
          .where({
            activityID: 1,
            typeID: blueprint.typeID,
          }).select('materialTypeID', 'quantity')
          .then(results => {
            _.forEach(results, row => {
              quantities[row.materialTypeID] = {
                quantity: row.quantity,
              }
            })
          }).then(() => {
            ////
            /// Quantity -> Price calculation starts here
            ////
            const keys = _.keys(quantities)
            return bluebird.map(keys, type_id => {
              return priceOf(type_id).then(data => {
                quantities[type_id].prices = _.reduce(data, (acc, row) => {
                  const ts = row.date_of.getTime() / 1000
                  acc[ts] = parseFloat(row.price)
                  return acc
                }, {})
              })
            }).then(() => {
              const dates = _.intersection.apply(_,
                _.map(keys, type_id => {
                  return _.keys(quantities[type_id].prices)
                })
              )

              return _.reduce(dates, (acc, ts) => {
                acc[ts] = _.reduce(keys, (sum, type_id) => {
                  const obj = quantities[type_id]
                  return sum + (obj.prices[ts] * Math.ceil(obj.quantity * 0.9))
                }, 0) * (1 + (0.04 * 1.1 * 0.69))
                // 4% system cost index + HS NPC taxes. 0.69 is a magic number
                // to approximate the actual CCP base_value
                // https://forums.eveonline.com/default.aspx?g=posts&t=432695
                return acc
              }, {})
            })
          })
        }
      })

      // T2 Invention materials
      // select "materialTypeID",iam.quantity from "industryActivityMaterials" iam join "industryActivityProducts" iap on (iap."typeID"=iam."typeID") where iam."activityID"=8 and iap."activityID"=8 and iap."productTypeID"= :blueprint_id

      // T2 Invention probability
      // select probability from "industryActivityProbabilities" where "productTypeID" = :blueprint_id
      // zero probabilities == T1, 1 == T2, 2+ == T3

      // T2 Invention Quantity
      // (100 / (Base_Chance * 1.45833) * quantity

      // T3 is the same as T2 but you have to include the price of the relic (use intact)
    }),
  ]).spread((daily, fine_grained, build_costs) => {
    if (build_costs) {
      _.forEach(daily, row => {
        if (build_costs[row.unix_ts])
          row.build_cost = build_costs[row.unix_ts]
      })

      _.forEach(fine_grained, row => {
        const ts = row.unix_ts - (row.unix_ts % 86400)
        if (build_costs[ts])
          row.build_cost = build_costs[ts]
      })
    }

    res.json({
      recent: fine_grained,
      historical: daily,
    })
  }).catch(next)
})

module.exports = router
