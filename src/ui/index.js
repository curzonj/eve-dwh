'use strict';

require('./pie_timer')

var $ = global.$
var io = require('socket.io-client')
var _ = require('lodash')

document.title = 'Order Status'

if (window.Notification === undefined) {
  window.Notification = { requestPermission: function() { } }
}

Notification.requestPermission(function() {})

$('#messages').on('click', '.an_order', function() {
  $(this).remove()
})

var socket = io()

function reportSocketError(e) {
  console.log(e)
  if ($('div#conn-error-alert').length === 0) {
    $('div#alerts').append(require('./connection_alert.hbs'))
  }
}

socket.on('connect_error', reportSocketError)
socket.on('reconnect_error', reportSocketError)
socket.on('reconnect_failed', reportSocketError)

function announceOrderOutBid(msg) {
  console.log(msg)
  var term = msg.buy ? 'buy' : 'sell'
  var key = msg.type_id+'-'+msg.station_id+'-'+term
  var existing_elem = $('#'+key)
  var notify = false

  if ((msg.buy === true && msg.price < msg.buy_price_max) || (msg.buy === false && msg.price > msg.sell_price_min)) {
    var system_name = msg.station_name.split(' ')[0]
    var profit = msg.profit.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
    var klass = msg.profit > 0 ? 'gain' : 'loss'

    var dom = $(require('./order_outbid.hbs')({
      key: key,
      term: term,
      type_id: msg.type_id,
      system_name: system_name,
      character_name: msg.character_name,
      type_name: msg.type_name,
      klass: klass,
      profit: profit,
    }))

    if (existing_elem.length) {
      console.log('replacing '+key)
      existing_elem.replaceWith(dom)
    } else {
      console.log('adding new '+key)
      $('#messages').append(dom)
      existing_elem = $('#'+key)
      notify = true
    }

    var new_elem = $('#'+key+' > .order_pie')
    new_elem.pietimer({
      seconds: 300,
      start_with: 300,
      color: 'rgba(0, 0, 0, 0.3)',
      height: 20,
      width: 20,
    }, function() {})
    new_elem.pietimer('start')

    return notify
  } else {
    console.log(key+' is not outbid')
    existing_elem.remove()
  }
}

/*
group the orders by type_id, region_id, and buy,
return just the best priced record
*/

socket.on('order_announcement', function(orders) {
  _.forEach(orders, (msg) => {
    announceOrderOutBid(msg)
  })
})

socket.on('order_status', function(orders) {
  _.forEach(orders, (msg) => {
    if (announceOrderOutBid(msg)) {
      var system_name = msg.station_name.split(' ')[0]
      Notification.requestPermission(function() {
        var term = msg.buy ? 'Buy' : 'Sell'
        var notification = new Notification(term+' order for '+msg.type_name+' outbid in '+system_name, {
          icon: 'https://image.eveonline.com/Type/'+ msg.type_id +'_64.png',
        })
      })
    }
  })
})
