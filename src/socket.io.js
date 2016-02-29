'use strict';

const pubsub = require('./pubsub')
const debug = require('./debug')
const errors = require('./errors')
const bluebird = require('bluebird')
const sql = require('./sql')
const _ = require('lodash')

module.exports = function(io) {
    io.on('connection', errors.fn.catch(function(socket){
        debug('http', { at: "socket.io#connection", user: JSON.stringify(socket.request.user)})

        socket.on('chat message', function(msg){
            pubsub.emit('chat_message', msg)
        })

        pubsub.usingSocket(socket, 'chat_message', function(msg) {
            socket.emit('chat message', msg)
        })

        function character_order_details(table_pre) {
            return sql('character_order_details AS c').
                innerJoin(table_pre+'_orders AS m', 'c.id', 'm.id').
                innerJoin('characters AS c2', 'c.character_id', 'c2.character_id').
                innerJoin('staStations AS s2', 's2.stationID', 'c.station_id').
                innerJoin('invTypes AS i', 'i.typeID', 'c.type_id').
                innerJoin('station_order_stats AS s', function() {
                    this.on('s.region_id', '=', 'c.region_id').andOn('s.type_id', '=', 'c.type_id').andOn('s.station_id', '=', 'c.station_id')
                }).
                select('m.id', 'm.price', 'm.volume_entered', 'm.volume_remaining', 'm.station_id', 'c.character_id', 'm.region_id', 'm.buy', 'c2.name AS character_name', 's2.stationName AS station_name', 's.buy_price_max', 's.sell_price_min', 'c.type_id', 'i.typeName AS type_name',
                    sql.raw("round((s.sell_price_min * 0.985) - (s.buy_price_max * 1.0075), 2) profit"),
                    sql.raw("round(((s.sell_price_min * 0.985) - (s.buy_price_max * 1.0075)) / s.sell_price_min, 2) profit_pct"),
                    sql.raw("round(s.sell_price_min  - s.buy_price_max, 2) current_margin"),
                    sql.raw("round(s.sell_price_min * (1 - ((1 - 0.0075 - 0.015) / (1 + 0.0075))), 2) minimum_margin"),
                    sql.raw("round(s.sell_price_min * ((1 - 0.0075 - 0.015) / (1 + 0.0075)), 2) max_buy_offer_price"),
                    sql.raw("round(s.buy_price_max * ((1 + 0.0075) / (1 - 0.0075 - 0.015)), 2) min_sell_offer_price") // TODO base this price off my current COGS
                )
        }

        pubsub.usingSocket(socket, 'my_order_polling', function(msg) {
            bluebird.all([
                character_order_details('market').where({ "c.type_id": msg.type_id, "c.region_id": msg.region_id }).tap(sql.utils.parseNumbers),
                //character_order_details('historical').where({ "c.type_id": msg.type_id, "c.region_id": msg.region_id })
            ]).spread((orders, old_orders) => {
                debug('test', { orders: JSON.stringify(orders) })
                _.forEach(orders, (o) => { socket.emit('order_status', o) })
                //_.forEach(old_orders, (o) => { socket.emit('old_orders', o) })
            })
        })

        character_order_details('market').tap(sql.utils.parseNumbers).then(function(orders) {
            _.forEach(orders, (o) => { socket.emit('order_announcement', o) })
        })
    }))
}
