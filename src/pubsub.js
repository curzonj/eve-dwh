'use strict';

const sql = require('./sql')
const pg = require('pg')
const logfmt = require('logfmt')
const rollbar = require('./rollbar')
const bluebird = require('bluebird')
const _ = require('lodash')
const events = require('events')

var connection = _.memoize(function() {
    return new bluebird(function (resolve, reject) {
        pg.connect(sql.DATABASE_URL, function(err, client, done) {
            if (err) {
                rollbar.handleError(err)
                logfmt.namespace({ fn: "pubsub.js#pg.connect" }).error(err)

                reject(err)
            } else {
                client.on('notification', function(msg) {
                    if (msg.name === 'notification') {
                        var payload = msg.payload
                        try { payload = JSON.parse(payload) } catch(e) { }

                        dispatcher.emit(msg.channel, payload)
                    }
                })

                resolve(bluebird.promisifyAll(client))
            }
        })
    })
})

// This way we only have 1 postgres connection for
// pubsub per process and only 1 LISTEN session
const dispatcher = new events()
var registered = {}

//dispatcher.setMaxListener(0)

var self = module.exports = {
    on: function(channel, fn) {
        return bluebird.try(function() {
            if (registered[channel] === undefined) {
                registered[channel] = true
                return connection().then(function(client) {
                    return client.queryAsync("LISTEN "+channel)
                })
            }
        }).then(function() {
            dispatcher.on(channel, fn)
        })
    },

    usingSocket: function(socket, channel, fn) {
        socket.on('disconnect', function () {
          self.removeListener(channel, fn)
        });
        self.on(channel, fn)
    },

    // It's easiest for the process to just keep listening
    removeListener: function(channel, fn) {
        dispatcher.removeListener(channel, fn)
    },

    emit: function(channel, payload) {
        return connection().then(function(client) {
            return client.queryAsync("select pg_notify($1, $2)", [ channel, JSON.stringify(payload) ])
        })
    }
}
