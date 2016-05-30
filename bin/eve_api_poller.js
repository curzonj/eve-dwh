#!/usr/bin/env node

'use strict';

const bluebird = require('bluebird')
const bluebirdThrottle = require('promise-throttle')
const logfmt = require('logfmt')
const _ = require('lodash')
const lib = require('../src/library')
const sql = require('../src/sql')
const debug = require('../src/debug')
const neow = require('neow')

lib.setupSignalHandlers()

const throttle = new bluebirdThrottle({
  requestsPerSecond: 30,
  promiseImplementation: bluebird,
})

function limitClient(client, endpoint, data) {
  return throttle.add(function() {
    debug('eve:xml', _.assign({
      endpoint: endpoint,
    }, data))
    return client.fetch(endpoint, data)
  })
}

function eachApiKeyTarget(name, fn) {
  return sql('eve_api_keys').then(function(rows) {
    return bluebird.each(rows, function(key_row) {
      var client = lib.buildEveClient(key_row.key_id, key_row.vcode)
      if (key_row.is_corporate) {
        return bluebird.each(sql('managed_corps').where({
            key_id: key_row.key_id,
          }).pluck('corporation_id'),
          function(corp_id) {
            return bluebird.resolve(fn(client, null, corp_id)).then(function() {
              logfmt.log({
                import: name,
                key_id: key_row.key_id,
                corporation_id: corp_id,
                at: 'finished',
                fn: 'eachApiKeyTarget',
              })
            })
          }).then(function() {
          logfmt.log({
            import: name,
            key_id: key_row.key_id,
            at: 'finished',
            fn: 'eachApiKeyTarget',
          })
        })

      } else {
        return bluebird.each(sql('managed_characters').where({
            key_id: key_row.key_id,
          }).pluck('character_id'),
          function(char_id) {
            return bluebird.resolve(fn(client, char_id)).then(function() {
              logfmt.log({
                import: name,
                key_id: key_row.key_id,
                character_id: char_id,
                at: 'finished',
                fn: 'eachApiKeyTarget',
              })
            })
          }).then(function() {
          logfmt.log({
            import: name,
            key_id: key_row.key_id,
            at: 'finished',
            fn: 'eachApiKeyTarget',
          })
        })
      }
    })
  })
}

function importIndustryJobs(data) {
  return bluebird.map(_.values(data.jobs),
    function(t) {
      lib.debug('import', {
        at: 'industry_jobs',
        data: JSON.stringify(t),
      })

      const job_id = parseInt(t.jobID)
      const completed_date = t.completedDate === '0001-01-01 00:00:00' ? null : new Date(t.completedDate)
      const start_date = new Date(t.startDate)

      if (isNaN(start_date.getTime())) {
        logfmt.namespace({
          fn: 'importIndustryJobs',
          at: 'date_error',
          job_id: job_id,
          start_date: t.startDate,
        })
        return
      }

      return sql('industry_jobs').insert({
        job_id: job_id,
        installer_id: parseInt(t.installerID),
        activity_id: parseInt(t.activityID),
        blueprint_type_id: parseInt(t.blueprintTypeID),
        start_date: new Date(t.startDate),
        completed_date: completed_date,
        job_data: t,
      }).catch(e => {
        if (e.message.indexOf('duplicate key value') > 0) {
          sql('industry_jobs').where({ job_id: job_id }).update({
            completed_date: completed_date,
            job_data: t,
          })
        } else {
          logfmt.namespace({
            fn: 'importIndustryJobs',
            at: 'insert_errror',
            job_id: job_id,
          }).error(e)
        }
      })
    }, {
      concurrency: 10,
    })
}


// 15min timer, IndustryJobs
lib.cronTask(900, function() {
  return bluebird.try(function() {
    return eachApiKeyTarget('IndustryJobs', function(client, char_id, corp_id) {
      return bluebird.try(function() {
        if (char_id === null) {
          return limitClient(client, 'corp:IndustryJobs', { })
        } else {
          return limitClient(client, 'char:IndustryJobs', {
            characterID: char_id,
          })
        }
      }).then(importIndustryJobs)
    })
  })
})

// 6hr timer, IndustryJobHistory
lib.cronTask(21600, function() {
  return bluebird.try(function() {
    return eachApiKeyTarget('IndustryJobsHistory', function(client, char_id, corp_id) {
      return bluebird.try(function() {
        if (char_id === null) {
          return limitClient(client, 'corp:IndustryJobsHistory', { })
        } else {
          return limitClient(client, 'char:IndustryJobsHistory', {
            characterID: char_id,
          })
        }
      }).then(importIndustryJobs)
    })
  })
})

/*

// 30min timer, wallet journal + transactions
lib.cronTask(1800, function() {
  return bluebird.try(function() {
    return eachApiKeyTarget('WalletTransactions', function(client, char_id, corp_id) {
      return bluebird.try(function() {
        if (char_id === null) {
          return limitClient(client, 'corp:WalletTransactions', {
            accountKey: 1000,
          })
        } else {
          return limitClient(client, 'char:WalletTransactions', {
            characterID: char_id,
          })
        }
      }).then(function(data) {
        return bluebird.map(_.values(data.transactions),
          function(t) {
            var client_id = parseInt(t.clientID)
            lib.debug('import', {
              at: 'transaction',
              data: JSON.stringify(t),
            })

            return bluebird.all([
              sql.raw(sql('wallet_transactions').insert({
                transaction_id: parseInt(t.transactionID),
                occured_at: new Date(t.transactionDateTime),
                character_id: char_id || parseInt(t.characterID),
                corporation_id: corp_id,
                quantity: parseInt(t.quantity),
                type_id: parseInt(t.typeID),
                price: parseFloat(t.price).toFixed(2),
                client_id: client_id,
                station_id: parseInt(t.stationID),
                buy: (t.transactionType === 'buy'),
                corporate_order: (t.transactionFor === 'corporation'),
                journal_ref_id: parseInt(t.journalTransactionID),
              }).toString() + ' ON CONFLICT (character_id, transaction_id) DO NOTHING'),
              sql.raw(sql('characters').insert({
                character_id: client_id,
                name: sql.raw('?'),
              }).toString() + ' ON CONFLICT (character_id) DO NOTHING', [
                t.clientName, // we have to use binds for proper safety
              ]),
            ])
          }, {
            concurrency: 10,
          })
      }).then(function() {
        if (char_id === null) {
          return limitClient(client, 'corp:WalletJournal', {
            accountKey: 1000,
          })
        } else {
          return limitClient(client, 'char:WalletJournal', {
            characterID: char_id,
          })
        }
      }).then(function(data) {
        return bluebird.map(_.values(data.transactions),
          function(t) {
            lib.debug('import', {
              at: 'journal',
              data: JSON.stringify(t),
            })

            return sql.raw(sql('wallet_journal').insert({
              journal_ref_id: parseInt(t.refID),
              entity_id: (char_id || corp_id),
              entity_character: (corp_id === undefined),
              occured_at: new Date(t.date),
              ref_type_id: parseInt(t.refTypeID),
              party_1_id: parseInt(t.ownerID1),
              party_2_id: parseInt(t.ownerID2),
              amount: parseFloat(t.amount).toFixed(2),
              reason: t.reason,
              tax_collector_id: parseInt(t.taxReceiverID) || null,
              tax_amount: (t.taxAmount !== '' ? parseFloat(t.taxAmount).toFixed(2) : null),
              optional_id: parseInt(t.argID1),
              optional_value: t.argName1,
            }).toString() + ' ON CONFLICT (entity_character, entity_id, journal_ref_id) DO NOTHING')
          }, {
            concurrency: 10,
          })
      })
    })
  })
})

// 1hr timer, market orders, planetary interaction
lib.cronTask(3600, function() {
  return bluebird.try(function() {
    // market orders
    const orders_by_char = {}
    return eachApiKeyTarget('MarketOrders', function(client, char_id, corp_id) {
      return bluebird.try(function() {
        if (char_id === null) {
          return limitClient(client, 'corp:MarketOrders', {
            corporationID: corp_id,
          })
        } else {
          return limitClient(client, 'char:MarketOrders', {
            characterID: char_id,
          })
        }
      }).then(function(data) {
        return bluebird.map(
          _.reject(_.values(data.orders), (o)=> { return o.orderState !== '0' }),
          function(t) {
            lib.debug('import', {
              at: 'order',
              data: JSON.stringify(t),
            })
            var station_id = parseInt(t.stationID)

            const order_id = parseInt(t.orderID)
            const character_id = parseInt(t.charID)
            const char_order_list = orders_by_char[character_id] || []
            orders_by_char[character_id] = char_order_list
            char_order_list.push(order_id)

            return sql.raw(sql('character_order_details').insert({
              id: order_id,
              character_id: character_id,
              order_state: parseInt(t.orderState),
              account_key: parseInt(t.accountKey),
              escrow: parseFloat(t.escrow).toFixed(2),
              issued_at: lib.parseUTC(t.issued),
              type_id: parseInt(t.typeID),
              station_id: station_id,
              region_id: sql('staStations').select('regionID').where({
                stationID: station_id,
              }),
            }).toString() + ' ON CONFLICT (id) DO UPDATE SET escrow = EXCLUDED.escrow, issued_at = EXCLUDED.issued_at')
          }, {
            concurrency: 10,
          })
      }).then(function() {
        return bluebird.each(_.keys(orders_by_char), function(char_id) {
          return sql('character_order_details')
          .where('character_id', char_id)
          .whereNotIn('id', orders_by_char[char_id]).delete()
        })
      }).then(function() {
        return sql('character_order_details').whereNotIn('character_id', _.keys(orders_by_char)).delete()
      }).then(function() {
        return sql.raw(
          'UPDATE market_polling m set orders_polling_override = orders_polling_interval, orders_polling_interval = interval \'5 minutes\', orders_next_polling_at = now() from character_order_details c where c.type_id = m.type_id and c.region_id = m.region_id and m.orders_polling_override is null; '
        )
      })
    })
  })
})

// 1hr timer, map statistics
lib.cronTask(3600, function() {
  const client = new neow.EveClient({}, null, lib.neowCache)
  return bluebird.all([
    limitClient(client, 'map:kills', {}).then(data => { return data.solarSystems }),
    limitClient(client, 'map:Jumps', {}).then(data => { return data.solarSystems }),
  ]).spread((kills, jumps) => {
    const system_ids = _.union(_.keys(kills), _.keys(jumps))
    const now = new Date()
    const hour = now.getHours()

    return bluebird.each(system_ids, id => {
      return sql.raw(sql('eve_map_stats').insert({
        region_id: sql('mapSolarSystems').select('regionID').where({
          solarSystemID: id,
        }),
        system_id: id,
        date_of: now,
        hour: hour,

        ship_kills: _.get(kills[id], 'shipKills'),
        pod_kills: _.get(kills[id], 'podKills'),
        npc_kills: _.get(kills[id], 'factionKills'),
        jumps: _.get(jumps[id], 'shipJumps'),
      }).toString() + 'ON CONFLICT (system_id, date_of, hour) DO NOTHING')
    })
  })
})

// 2hr timer, assets
lib.cronTask(7200, function() {
  return bluebird.try(function() {
    var virtual = {}

    function accumulateResults(data) {
      _.each(data.assets, function(item) {
        var location_id = parseInt(item.locationID)

        // Ignore anything in player conquerable stations
        if (item.singleton !== '1' && 60000000 < location_id && location_id < 61000000) {
          var pair = [item.locationID, item.typeID]
          var value = parseInt(item.quantity)

          if (isNaN(value))
            throw ('' + value + ' failed to parse as a number')

          virtual[pair] = (virtual[pair] || 0) + value
        }
      })
    }

    var now = new Date()

    return eachApiKeyTarget('AssetList', function(client, char_id, corp_id) {
      return bluebird.try(function() {
        if (char_id === null) {
          return limitClient(client, 'corp:AssetList', {
            corporationID: corp_id,
          })
        } else {
          return limitClient(client, 'char:AssetList', {
            characterID: char_id,
          })
        }
      }).then(accumulateResults)
    }).then(function() {
      return bluebird.each(_.keys(virtual), function(pair) {
        var quantity = virtual[pair]
        pair = pair.split(',')
        var station_id = parseInt(pair[0])
        var type_id = parseInt(pair[1])

        return sql.raw('insert into assets values (?, ?, ?, ?) ON CONFLICT (type_id, station_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = EXCLUDED.updated_at', [station_id, type_id, quantity, now])
      }).then(function() {
        return sql.raw('delete from assets where updated_at < ?', [now])

      })
    })
  })
})
*/
