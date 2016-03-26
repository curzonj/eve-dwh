'use strict';

const logfmt = require('logfmt')
const _ = require('lodash')
const bluebird = require('bluebird')
const bluebirdThrottle = require('promise-throttle')
const moment = require('moment')
const sql = require('./sql')
const debug = require('./debug')
const rollbar = require('./rollbar')
const signals = require('./signals')

const neow = require('neow')
const cacheLib = require('./neow_db_cache')
const neowCache = new cacheLib.DbCache()

function buildEveClient(key_id, vcode) {
  return new neow.EveClient({
    keyID: key_id,
    vCode: vcode,
  }, null, neowCache)
}

_.assign(exports, {
  setupSignalHandlers: () => {
    signals.setup()
  },
  debug: debug,
  sql: sql,
  rollbar: rollbar,
  neowCache: neowCache,
  buildEveClient: buildEveClient,
  datePartitionedPostfix: function() {
    return moment().format('[y]YYYY[m]MM')
  },
  parseUTC: function(str) {
    return new Date(str + '+00:00')
  },
  cronTask: function(interval, fn) {
    function scheduleNext() {
      var start = moment()

      return bluebird.try(function() {
        fn()
      }).catch(function(e) {
        logfmt.error(e)
      }).then(function(nextRun) {
        var delay = (interval * 1000) - moment().diff(start)
        if (delay > 0) {
          return bluebird.delay(delay).then(scheduleNext)
        } else {
          return bluebird.try(scheduleNext)
        }
      })

    }

    return scheduleNext()
  },
  pollingLoop: function(fn) {
    function _innerLoop() {
      return fn().catch(function(e) {
        rollbar.handleError(e)
        logfmt.namespace({
          fn: 'pollingLoop',
        }).error(e)
      }).then(function(sleep) {
        var delay = 1
        if (sleep)
        // Standard 30sec delay if it wants to sleep
          delay = 30000

        return bluebird.delay(delay).then(_innerLoop)
      })
    }

    return _innerLoop()
  },
  importManagedCorps: function() {
    return sql('eve_api_keys').where('is_corporate', true).then(function(rows) {
      return bluebird.each(rows, function(key_row) {
        var client = buildEveClient(key_row.key_id, key_row.vcode)

        return client.fetch('account:Characters').then(function(result) {
          var ceo = _.head(_.values(result.characters))

          return bluebird.try(function() {
            return sql('corporations').insert({
              corporation_id: parseInt(ceo.corporationID),
              name: ceo.corporationName,
            })
          }).then(function() {
            return sql('managed_corps').insert({
              corporation_id: parseInt(ceo.corporationID),
              key_id: key_row.key_id,
            })
          })
        })
      })
    })

  },
  importManagedCharacters: function() {
    return sql('eve_api_keys').where('is_corporate', false).then(function(rows) {
      return bluebird.each(rows, function(key_row) {
        var client = buildEveClient(key_row.key_id, key_row.vcode)

        return client.fetch('account:Characters').then(function(result) {
          return bluebird.each(_.values(result.characters), function(character) {
            return sql.raw(sql('characters').insert({
              character_id: parseInt(character.characterID),
              name: sql.raw('?'),
            }).toString() + ' ON CONFLICT (character_id) DO NOTHING', [character.name]).then(function() {
              return sql.raw(sql('managed_characters').insert({
                character_id: parseInt(character.characterID),
                key_id: key_row.key_id,
              }).toString() + ' ON CONFLICT (character_id) DO NOTHING')
            })
          })
        })
      })
    })
  },
})
