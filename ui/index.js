'use strict';

var $ = require('jquery')
var io = require('socket.io-client')
var _ = require('lodash')

document.title = 'Order Status'
$('body').append('<ul id="messages"></ul>')
$('head').append('<meta name="viewport" content="width=480">')

if (window.Notification === undefined) {
  window.Notification = { requestPermission: function() { } }
}

Notification.requestPermission(function() {})

$('#messages').on('click', '.an_order', function() {
  $(this).remove()
})

var socket = io()

function announceOrderOutBid(msg) {
  console.log(msg)
  var term = msg.buy ? 'buy' : 'sell'
  var key = msg.type_id+'-'+msg.station_id+'-'+term
  var existing_elem = $('#'+key)

  if ((msg.buy === true && msg.price < msg.buy_price_max) || (msg.buy === false && msg.price > msg.sell_price_min)) {
    var system_name = msg.station_name.split(' ')[0]
    var profit = msg.profit.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
    var klass = msg.profit > 0 ? 'gain' : 'loss'

    var dom = $('<li class="an_order" id="'+key+'">')
    dom.append('<img style="float:left; margin: 0px 15px 5px 0px;" align="top" src="https://image.eveonline.com/Type/'+ msg.type_id +'_64.png">')
    dom.append('<div style="margin: 20px 0px 0px;"><span><b>'+system_name+'</b> '+term+' order by '+msg.character_name+' outbid.<br/></span><b>'+ msg.type_name+'</b> <span class="'+klass+'">Current Profit: '+profit+'</span></div>')
    dom.append('<br style="clear: both;" />')

    if (existing_elem.length) {
      console.log('replacing '+key)
      existing_elem.replaceWith(dom)
      return false
    } else {
      console.log('adding new '+key)
      $('#messages').append(dom)
      return true
    }
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
