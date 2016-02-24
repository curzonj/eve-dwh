'use strict';

const logfmt = require('logfmt')
const rollbar = require('./rollbar')

module.exports = {
    fn: {
        catch: function(fn) {
            return function() {
                try {
                    return fn.apply(null, arguments)
                } catch(err) {
                    console.error(err.stack || err)
                    logfmt.error(err)
                    rollbar.handleError(err)

                    return err
                }
            }
        }
    }
}
