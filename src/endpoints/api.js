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

  return bluebird.all([
    sql(sql.raw('(select history_date AS date_of, type_id, region_id, quantity, average from market_history) h'))
    .where({
      type_id: req.params.type_id,
      region_id: req.query.region_id,
      //  station_id: req.query.station_id,
    }).leftJoin(sql.raw('(select * from market_daily_stats where type_id = ? and region_id = ? and station_id = ?) m using (type_id, region_id, date_of)', [req.params.type_id, req.query.region_id, req.query.station_id]))
    .whereRaw('date_of >= current_timestamp - cast(? as interval)', ['6 months'])
    .select('date_of', 'quantity AS region_units', 'average AS region_avg', 'day_buy_price_wavg_tx',
    'day_sell_price_wavg_tx', 'day_avg_buy_units', 'day_avg_sell_units').
    then(data => {
      return _.map(data, row => {
        return {
          unix_ts: row.date_of.getTime()/1000,
          region_units: parseFloat(row.region_units),
          region_avg: parseFloat(row.region_avg),
          buy_price_max: parseFloat(row.day_buy_price_wavg_tx),
          buy_units: parseFloat(row.day_avg_buy_units),
          sell_price_min: parseFloat(row.day_sell_price_wavg_tx),
          sell_units: parseFloat(row.day_avg_sell_units),
        }
      })
    }),
    sql('market_daily_stats').where({
      type_id: req.params.type_id,
      region_id: req.query.region_id,
      station_id: req.query.station_id,
    }).whereRaw('date_of >= current_timestamp - cast(? as interval)', ['7 days'])
    .select(columns).select('stats_timestamp')
    .then(data => {
      return _.flatten(_.map(data, row => {
        return _.map(row.stats_timestamp, (value, index, col) => {
          var fake_row = { unix_ts: value }
          _.forEach(columns, name => {
            fake_row[name] = parseFloat(row[name][index])
          })
          return fake_row
        })
      }))
    }),
  ]).spread((daily, fine_grained) => {
    res.json({
      recent: fine_grained,
      historical: daily,
    })
  }).catch(next)
})

module.exports = router
