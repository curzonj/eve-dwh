'use strict';

const bluebird = require('bluebird')
const stats = require('./stats_collection')
const sql = require('./sql')
const debug = require('./debug')
const os = require('os')
const hostname = os.hostname()
const proc_type = process.env.PROC_TYPE


bluebird.try(function() {
  debug('metrics', 'Initialization started')
  return sql('metric_observations').where({
    hostname: hostname,
    proc_type: proc_type,
  }).delete()
}).then(function() {
  return sql('metric_observations').insert({
    hostname: hostname,
    updated_at: sql.raw('current_timestamp'),
    proc_type: proc_type,
    metrics: {},
  })
}).then(function() {
  setInterval(function() {
    const data = stats.toJSON()
    debug('metrics', JSON.stringify(data, null, 2))

    sql('metric_observations').where({
      hostname: hostname,
      proc_type: proc_type,
    }).update({
      updated_at: sql.raw('current_timestamp'),
      metrics: data,
    }).then(function() {
      debug('metrics', 'Metrics recorded to db')
    })
  }, 60000)
}).then(function() {
  debug('metrics', 'Recording initialized')
})

// Cleanup old metrics every hour
setInterval(function() {
  sql('metric_observations').whereRaw('updated_at < now() - interval \'1 day\'').delete()
}, 360000)

module.exports = {
  stats: stats,
}
