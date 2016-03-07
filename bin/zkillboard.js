#!/usr/bin/env node

'use strict';

const bluebird = require('bluebird')
const bluebirdThrottle = require('promise-throttle')
const logfmt = require('logfmt')
const _ = require('lodash')
const lib = require('../src/library')
const sql = require('../src/sql')
const debug = require('../src/debug')
const rp = require('request-promise')
rp.errors = require('request-promise/errors')

lib.setupSignalHandlers()

// every 5 minutes
lib.cronTask(300, function() {
  return bluebird.try(() => {
    return rp({
      uri: 'https://zkillboard.com/api/no-attackers/pastSeconds/320/',
      headers: {
        'User-Agent': process.env.CONTACT_STRING,
      },
      gzip: true,
      json: true,
    })
  }).then(data => {
    return bluebird.map(data, kill => {
      return sql('zkillboard_data').insert({
        kill_id: kill.killID,
        system_id: kill.solarSystemID,
        kill_time: kill.killTime,
        kill_data: kill,
      }).then(() => {
        logfmt.log({ fn: 'zkillboard.js', at: 'insert_kill', kill_id: kill.killID, kill_time: kill.killTime })
      }).catch(() => {
        logfmt.log({ fn: 'zkillboard.js', at: 'duplicate_kill', kill_id: kill.killID, kill_time: kill.killTime })
      })
    })
  })
})
