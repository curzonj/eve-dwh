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
    if (socket.request.user.logged_in !== true) {
      socket.close()
      return
    }

    const account_id = socket.request.user.account_id;

    debug('http', {
      at: 'socket.io#connection',
      account_id: account_id,
    })

    socket.on('chat message', function(msg) {
      pubsub.emit('chat_message', msg)
    })

    pubsub.usingSocket(socket, 'chat_message', function(msg) {
      socket.emit('chat message', msg)
    })

    pubsub.usingSocket(socket, 'my_order_polling', function(msg) {
      bluebird.all([
        queries.character_order_details(account_id).where({
          'c.type_id': msg.type_id,
          'c.region_id': msg.region_id,
        }).tap(sql.utils.parseNumbers),
      ]).spread((orders, old_orders) => {
        debug('test', {
          orders: JSON.stringify(orders),
        })
        socket.emit('order_status', orders)
        //_.forEach(old_orders, (o) => { socket.emit('old_orders', o) })
      })
    })

    queries
      .character_order_details(account_id)
      .tap(sql.utils.parseNumbers).then(function(orders) {
        socket.emit('order_announcement', orders)
      })
  }))
}
