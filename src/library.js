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

_.assign(exports, {
  setupSignalHandlers: () => {
    signals.setup()
  },
  debug: debug,
  sql: sql,
  rollbar: rollbar,
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
})
