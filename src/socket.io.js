'use strict';

const pubsub = require('./pubsub')
const debug = require('./debug')
const errors = require('./errors')
const bluebird = require('bluebird')
const sql = require('./sql')
const _ = require('lodash')
const queries = require('./queries')

module.exports = function(io) {
  io.on('connection', errors.fn.catch(function(socket) {
    debug('http', {
      at: 'socket.io#connection',
      user: JSON.stringify(socket.request.user),
    })

    socket.on('chat message', function(msg) {
      pubsub.emit('chat_message', msg)
    })

    pubsub.usingSocket(socket, 'chat_message', function(msg) {
      socket.emit('chat message', msg)
    })

    pubsub.usingSocket(socket, 'my_order_polling', function(msg) {
      bluebird.all([
        queries.character_order_details('market').where({
          'c.type_id': msg.type_id,
          'c.region_id': msg.region_id,
        }).tap(sql.utils.parseNumbers),
        //character_order_details('historical').where({ 'c.type_id': msg.type_id, 'c.region_id': msg.region_id })
      ]).spread((orders, old_orders) => {
        debug('test', {
          orders: JSON.stringify(orders),
        })
        _.forEach(orders, (o) => {
          socket.emit('order_status', o)
        })
        //_.forEach(old_orders, (o) => { socket.emit('old_orders', o) })
      })
    })

    queries.character_order_details('market').tap(sql.utils.parseNumbers).then(function(orders) {
      _.forEach(orders, (o) => {
        socket.emit('order_announcement', o)
      })
    })
  }))
}
