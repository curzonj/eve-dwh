'use strict';

global.orderNotificationsPage = require('./orders')

const Backbone = require('backbone')
const RouterClass = Backbone.Router.extend({
  routes: {
    stats:    'rickshaw',
    orders:   'orders',
    '*path':  'defaultRoute',
  },

  defaultRoute: function() {
    this.navigate('orders', { trigger: true })
  },

  orders: require('./orders'),
  rickshaw: require('./rickshaw'),
})

global.router = new RouterClass()

global.$(function() {
  Backbone.history.start()
})
