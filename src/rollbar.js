'use strict';

var rollbar 

if (process.env.ROLLBAR_TOKEN !== undefined) {
    rollbar = require("rollbar");
    rollbar.init(process.env.ROLLBAR_TOKEN)
    rollbar.handleUncaughtExceptions(process.env.ROLLBAR_TOKEN, { exitOnUncaughtException: true })
} else {
    rollbar = { handleError: function() {} }
}

module.exports = rollbar
