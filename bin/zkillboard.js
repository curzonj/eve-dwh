#!/usr/bin/env node

'use strict';

const bluebird = require('bluebird')
const bluebirdThrottle = require('promise-throttle')
const logfmt = require('logfmt')
const _ = require('lodash')
const lib = require('../src/library')
const sql = require('../src/sql')
const debug = require('../src/debug')
const moment = require('moment')
const rp = require('request-promise')
rp.errors = require('request-promise/errors')

lib.setupSignalHandlers()

var last_kill_id_p = sql('zkillboard_data').max('kill_id').then(result => {
  return (result[0].max || 52461117)
})

lib.cronTask(300, function() {
  return last_kill_id_p.then((last_kill_id) => {
    var url = 'https://zkillboard.com/api/no-attackers/afterKillID/'+last_kill_id+
              '/endTime/'+moment().utc().format('YYYYMMDDHHmm')+'/orderDirection/asc/'

    logfmt.log({ fn: 'zkillboard.js', at: 'fetch', url: url })

    return rp({
      uri: url,
      headers: {
        'User-Agent': process.env.CONTACT_STRING,
      },
      gzip: true,
      json: true,
    })
  }).then(data => {
    logfmt.log({ fn: 'zkillboard.js', at: 'results', count: data.length })

    return bluebird.map(data, kill => {
      return sql('zkillboard_data_'+lib.datePartitionedPostfix()).insert({
        kill_id: kill.killID,
        system_id: kill.solarSystemID,
        kill_time: kill.killTime,
        kill_data: kill,
      }).then(() => {
        logfmt.log({ fn: 'zkillboard.js', at: 'insert', kill_id: kill.killID, kill_time: kill.killTime })
      }).catch(e => {
        if (e.message.indexOf('duplicate key value') > 0) {
          logfmt.log({ fn: 'zkillboard.js', at: 'duplicate', kill_id: kill.killID, kill_time: kill.killTime })
        } else {
          logfmt.namespace({ fn: 'zkillboard.js', at: 'insert_errror', kill_id: kill.killID, kill_time: kill.killTime }).error(e)
        }
      })
    }).then(() => {
      if (data.length > 0) {
        const last_id = Math.max.apply(null, _.map(data, 'killID'))
        logfmt.log({ fn: 'zkillboard.js', at: 'finish', last_kill_id: last_id })

        if (!isNaN(last_id) && last_id > 0 && last_id !== Infinity)
          last_kill_id_p = bluebird.resolve(last_id)
      }
    })
  })
})
