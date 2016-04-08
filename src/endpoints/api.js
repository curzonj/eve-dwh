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

  return sql('invTypes')
    .where(function() {
      var chain = this.where('typeName', 'ILIKE', query)
      if (!isNaN(int_id) && int_id > 0)
        chain.orWhere('typeID', int_id)
    })
    .where({ published: true })
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
  const columns = _.split(req.query.columns, ',')

  return sql('market_daily_stats').where({
      type_id: req.params.type_id,
      region_id: req.query.region_id,
      station_id: req.query.station_id,
    }).whereRaw('date_of >= current_timestamp - cast(? as interval)', [req.query.limit])
    .select(columns).select('stats_timestamp')
    .then(data => {
      res.json(_.sortBy(_.flatten(_.map(data, row => {
        return _.map(row.stats_timestamp, (value, index, col) => {
          var fake_row = { unix_ts: value }
          _.forEach(columns, name => {
            fake_row[name] = parseFloat(row[name][index])
          })
          return fake_row
        })
      })), 'unix_ts'))
    }).catch(next)
})

module.exports = router
