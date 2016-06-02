#!/usr/bin/env node

'use strict';

const bluebird = require('bluebird')
const bluebirdThrottle = require('promise-throttle')
const logfmt = require('logfmt')
const _ = require('lodash')
const lib = require('../src/library')
const sql = require('../src/sql')
const debug = require('../src/debug')
const xml_api = require('../src/eve_xml_api')

lib.setupSignalHandlers()

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
    return xml_api.eachApiKeyTarget('IndustryJobs', function(client, char_id, corp_id) {
      return bluebird.try(function() {
        if (char_id === null) {
          return xml_api.limitClient(client, 'corp:IndustryJobs', { })
        } else {
          return xml_api.limitClient(client, 'char:IndustryJobs', {
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
    return xml_api.eachApiKeyTarget('IndustryJobsHistory', function(client, char_id, corp_id) {
      return bluebird.try(function() {
        if (char_id === null) {
          return xml_api.limitClient(client, 'corp:IndustryJobsHistory', { })
        } else {
          return xml_api.limitClient(client, 'char:IndustryJobsHistory', {
            characterID: char_id,
          })
        }
      }).then(importIndustryJobs)
    })
  })
})

// 30min timer, wallet journal + transactions
lib.cronTask(1800, function() {
  return bluebird.try(function() {
    return xml_api.eachApiKeyTarget('WalletTransactions', function(client, char_id, corp_id) {
      return bluebird.try(function() {
        if (char_id === null) {
          return xml_api.limitClient(client, 'corp:WalletTransactions', {
            accountKey: 1000,
          })
        } else {
          return xml_api.limitClient(client, 'char:WalletTransactions', {
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
          return xml_api.limitClient(client, 'corp:WalletJournal', {
            accountKey: 1000,
          })
        } else {
          return xml_api.limitClient(client, 'char:WalletJournal', {
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
    return xml_api.eachApiKeyTarget('MarketOrders', function(client, char_id, corp_id) {
      return bluebird.try(function() {
        if (char_id === null) {
          return xml_api.limitClient(client, 'corp:MarketOrders', {
            corporationID: corp_id,
          })
        } else {
          return xml_api.limitClient(client, 'char:MarketOrders', {
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

// 1hr timer, market orders, planetary interaction
lib.cronTask(3600, function() {
  const AIFs = [2470, 2472, 2474, 2480, 2484, 2485, 2491, 2494]
  const launchPads = [2256, 2542, 2543, 2544, 2552, 2555, 2556, 2557]
  const storages = launchPads + [2257, 2535, 2536, 2541, 2558, 2560, 2561, 2562]

  return bluebird.try(function() {
    return xml_api.eachApiKeyTarget('PlanetaryInteraction', function(client, char_id, corp_id) {
      if (char_id === null)
        return

      return xml_api.limitClient(client, 'char:PlanetaryColonies', {
        characterID: char_id,
      }).then(colonies => {
        return bluebird.each(_.values(colonies.colonies), planet => {
          return bluebird.try(function() {
            return xml_api.rawEveResponse(client, function() {
              return client.fetch('char:PlanetaryPins', {
                characterID: planet.ownerID,
                planetID: planet.planetID,
              })
            }).then(function(pins) {
              return xml_api.limitClient(client, 'char:PlanetaryRoutes', {
                characterID: planet.ownerID,
                planetID: planet.planetID,
              }).then(function(routes) {
                return [pins, routes]
              })
            })
          }).spread(function(pins, routes) {
            // map to pin ids
            // fetch the routes
            // group AIFs by source
            var rebuilt = _.reduce(pins.pins, function(hash, pin) {
              var pinData

              if (!_.has(hash, pin.pinID)) {
                pinData = hash[pin.pinID] = {
                  pinID: parseInt(pin.pinID),
                  typeID: parseInt(pin.typeID),
                  schematicID: parseInt(pin.schematicID),
                  lastLaunchTime: new Date(pin.lastLaunchTime),
                  contents: {},
                  sources: {},
                  sinks: {},
                }
              } else {
                pinData = hash[pin.pinID]
              }

              pinData.contents[pin.contentTypeID] = parseInt(pin.contentQuantity)

              return hash
            })

            _.forEach(routes.routes, function(v) {
              var type_id = parseInt(v.contentTypeID);
              (rebuilt[v.sourcePinID].sinks[type_id] = rebuilt[v.sourcePinID].sinks[type_id] || []).push(v.destinationPinID);
              (rebuilt[v.destinationPinID].sources[type_id] = rebuilt[v.destinationPinID].sources[type_id] || []).push(v.sourcePinID);
            })

            return rebuilt
          }).tap(function(result) {
            return bluebird.each(_.values(result), function(value) {
              if (value.schematicID > 0)
                return sql('planetSchematicsTypeMap').where({
                  schematicID: value.schematicID,
                }).then(function(rows) {
                  value.schematics = rows
                })
            })
          }).then(function(result) {
            var storagePins = _.filter(_.values(result), function(o, i) {
              return _.includes(storages, o.typeID)
            })

            _.each(storagePins, function(pin) {
              pin.ttls = {}
              _.each(pin.sinks, function(other_id_list, type_id) {
                //console.log(pin.sinks)
                var rate_p_hour = 0
                var contents = pin.contents[type_id] || 0
                var earliest = new Date()

                _.each(other_id_list, function(other_pin_id) {
                  //console.log(other_id_list, other_pin_id)
                  var other_pin = result[other_pin_id]
                  var schem = _.find(other_pin.schematics, function(o) {
                    return o.isInput && o.typeID == type_id
                  })

                  rate_p_hour = rate_p_hour + schem.quantity
                  earliest = Math.min(other_pin.lastLaunchTime, earliest)
                })

                var done_at = new Date(earliest + ((contents / rate_p_hour) * 3600 * 1000))
                pin.ttls[type_id] = {
                  rate_p_hour: rate_p_hour,
                  earliest: new Date(earliest),
                  done_at: done_at,
                }
              })
            })

            return storagePins
          }).then(function(result) {
            return sql('planetary_observations').insert({
              planet_id: parseInt(planet.planetID),
              character_id: parseInt(planet.ownerID),
              observed_at: new Date(),
              last_updated_at: new Date(planet.lastUpdate),
              observation_data: {
                number_of_pins: parseInt(planet.numberOfPins),
                storage_contents: _.reduce(result, (acc, item) => {
                  if (!_.isEmpty(item.contents)) {
                    _.forEach(item.contents, (value, key) => {
                      acc[key] = value + (acc[key] || 0)
                    })
                  }
                  return acc
                }, {}),
                products: _.reduce(result, (acc, item) => {
                  if (!_.isEmpty(item.sources)) {
                    _.forEach(item.sources, (value, key) => {
                      acc[key] = _.size(value) + (acc[key] || 0)
                    })
                  }
                  return acc
                }, {}),
                inputs: _.reduce(result, (acc, item) => {
                  _.forEach(item.ttls, (value, key) => {
                    if (_.isUndefined(acc[key])) {
                      acc[key] = value
                    }
                  })
                  return acc
                }, {}),
              },
            }).catch(e => {
              if (e.message.indexOf('duplicate key value') === -1) {
                logfmt.namespace({
                  fn: 'importPlanetaryInteraction',
                  at: 'insert_errror',
                  planet_id: parseInt(planet.planetID),
                  character_id: parseInt(planet.ownerID),
                  updated_at: new Date(planet.lastUpdate),
                }).error(e)
              }
            })
          })
        })
      })
    })
  })
})

// 1hr timer, map statistics
lib.cronTask(3600, function() {
  const client = xml_api.buildEveClient()
  return bluebird.all([
    xml_api.limitClient(client, 'map:kills', {}).then(data => { return data.solarSystems }),
    xml_api.limitClient(client, 'map:Jumps', {}).then(data => { return data.solarSystems }),
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

    return xml_api.eachApiKeyTarget('AssetList', function(client, char_id, corp_id) {
      return bluebird.try(function() {
        if (char_id === null) {
          return xml_api.limitClient(client, 'corp:AssetList', {
            corporationID: corp_id,
          })
        } else {
          return xml_api.limitClient(client, 'char:AssetList', {
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
