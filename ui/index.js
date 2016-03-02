'use strict';

document.title = "Order Status"
$('body').append('<ul id="messages"></ul>')

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
    var key = msg.type_id+'-'+msg.station_id
    var existing_elem = $('#'+key)

    if ((msg.buy === true && msg.price < msg.buy_price_max) || (msg.buy === false && msg.price > msg.sell_price_min)) {
        var system_name = msg.station_name.split(' ')[0]
        var term = msg.buy ? 'buy' : 'sell'
        var profit = msg.profit.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
        var klass = msg.profit > 0 ? 'gain' : 'loss'

        var dom = $('<li class="an_order" id="'+key+'">')
        dom.append('<img style="float:left; margin: 0px 15px 5px 0px;" align="top" src="https://image.eveonline.com/Type/'+ msg.type_id +'_64.png">')
        dom.append('<div style="margin: 20px 0px 0px;"><span><b>'+system_name+'</b> '+term+' order by '+msg.character_name+' outbid.<br/></span><b>'+ msg.type_name+'</b> <span class="'+klass+'">Current Profit: '+profit+'</span></div>')
        dom.append('<br style="clear: both;" />')

        if ( existing_elem.length ) {
                existing_elem.replaceWith(dom)
                return false
        } else {
                $('#messages').append(dom)
                return true
        }
    } else {
            existing_elem.remove()
    }
}

socket.on('order_announcement', announceOrderOutBid)

socket.on('order_status', function(msg){
    if (announceOrderOutBid(msg)) {
        var system_name = msg.station_name.split(' ')[0]
        Notification.requestPermission(function() {
            var term = msg.buy ? 'Buy' : 'Sell'
            var notification = new Notification(term+' order for '+msg.type_name+" outbid in "+system_name, {
                icon: 'https://image.eveonline.com/Type/'+ msg.type_id +'_64.png'
            })
        })
    }
})
