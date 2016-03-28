'use strict';

const logfmt = require('logfmt')
const rollbar = require('./rollbar')

const self = module.exports = {
  fn: {
    report: function(err) {
      console.error(err.stack || err)
      logfmt.error(err)
      rollbar.handleError(err)
    },
    catch: function(fn) {
      return function() {
        try {
          return fn.apply(null, arguments)
        } catch (err) {
          self.fn.report(err)
          return err
        }
      }
    },
    httpPromiseError: function(req, res) {
      return function(err) {
        self.fn.report(err)
        res.status(500).json(err)
      }
    },
  },
}
