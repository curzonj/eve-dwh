'use strict';

const express = require('express');
const router = express.Router();
const lib = require('../library')
const sql = require('../sql')
const errors = require('../errors')
const _ = require('lodash')

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

router.get('/v1/types/:type_id/market/stats', (req, res, next) => {
  const columns = _.split(req.query.columns, ',')
  columns.unshift(sql.raw('extract(epoch from calculated_at) AS unix_ts'))

  return sql('market_order_stats_ts').where({
    type_id: req.params.type_id,
    region_id: req.query.region_id,
    station_id: req.query.station_id,
  }).select(columns)
  .then(data => {
    res.json(_.map(data, row => {
      _.forEach(row, (v,k,o) => {
        if (k !== 'calculated_at') {
          o[k] = parseFloat(v)
        }
      })

      return row
    }))
  }).catch(next)
})

module.exports = router
