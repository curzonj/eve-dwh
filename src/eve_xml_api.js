'use strict';

const bluebird = require('bluebird')
const bluebirdThrottle = require('promise-throttle')
const logfmt = require('logfmt')
const _ = require('lodash')
const debug = require('../src/debug')
const sql = require('../src/sql')
const lib = require('../src/library')
const neow = require('neow')
const cacheLib = require('./neow_db_cache')
const neowCache = new cacheLib.DbCache()

function buildEveClient(key_id, vcode) {
  const opts = {}
  if (key_id && vcode) {
    opts.keyID = key_id
    opts.vCode = vcode
  }

  return new neow.EveClient(opts, null, neowCache)
}

const throttle = new bluebirdThrottle({
  requestsPerSecond: 30,
  promiseImplementation: bluebird,
})

_.assign(exports, {
  buildEveClient: buildEveClient,
  limitClient: function(client, endpoint, data) {
    return throttle.add(function() {
      debug('eve:xml', _.assign({
        endpoint: endpoint,
      }, data))
      return client.fetch(endpoint, data)
    })
  },
  eachApiKeyTarget: function(name, fn) {
    return sql('eve_api_keys').then(function(rows) {
      return bluebird.each(rows, function(key_row) {
        var client = buildEveClient(key_row.key_id, key_row.vcode)
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
  },
  rawEveResponse: (function() {
    const parseString = bluebird.promisify(require('xml2js').parseString);
    return function(client, fn) {
      var oldParser = client.parser
      client.parser = {
        parse: function(data) {
          return parseString(data).then(function(result) {
            var retVal = {
              currentTime: _.head(result.eveapi.currentTime),
              cachedUntil: _.head(result.eveapi.cachedUntil),
            }

            _.forEach(_.head(result.eveapi.result).rowset, function(rowset) {
              retVal[rowset.$.name] = _.map(rowset.row, function(row) {
                return row.$
              })
            })

            return retVal
          })
        },
      }

      return fn().tap(function() {
        client.parser = oldParser;
      })
    }
  })(),
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
