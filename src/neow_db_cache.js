'use strict';

const caching = require('neow/lib/caching/index')
const _ = require('lodash')
const sql = require('./sql')
const debug = require('./debug')
const Q = require('q')

function DbCache() { }

DbCache.prototype = _.create(caching.Cache.prototype, {
  'constructor': DbCache,
  _get: function(hex) {
      return Q(sql("neow_cache").
          where({ sha1_hex: hex }).
          first().
          then(function(row) {
          if (row === undefined) {
              throw new Error("Element "+hex+" not found in cache!")
          } else if (caching.cacheExpired(row.cache_until))  {
              return sql("neow_cache").where({ sha1_hex: hex }).delete().then(function() {
                throw new Error("Element " + hex + " has expired")
              })
          } else {
              return row.json_data
          }
      }))
  },
  _set: function(hex, cache_until, data) {
      return Q(sql.transaction(function(trx) {
          return trx("neow_cache").where({ sha1_hex: hex }).first().then(function(row) {
              if (row) {
                  return trx("neow_cache").where({ sha1_hex: hex }).update({
                      cache_until: cache_until,
                      json_data: data
                  })
              } else {
                  return trx("neow_cache").insert({
                      sha1_hex: hex,
                      cache_until: new Date(cache_until),
                      json_data: data
                  })
              }
          })
      }).
      then(function() { return true }))
  },
  _del: function(hex) {
      return Q(sql("neow_cache").where({ sha1_hex: hex }).delete().
      then(function() { return true }))
  }
});

exports.DbCache = DbCache
