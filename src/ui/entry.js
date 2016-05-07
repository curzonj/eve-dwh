'use strict';

const $ = require('jquery')
const Backbone = require('backbone')
const Marionette = require('backbone.marionette')

const app = new Marionette.Application()
global.app = app

const Views = {
  rickshaw: require('./rickshaw'),
}

const RouterClass = Backbone.Router.extend({
  routes: {
    stats:    'rickshaw',
    orders:   'orders',
    '*path':  'defaultRoute',
  },

  defaultRoute: function() {
    this.navigate('stats', { trigger: true })
  },

  orders: require('./orders'),
  rickshaw: function() {
    app.mainRegion.show(new Views.rickshaw())
  },
})

app.router = new RouterClass()
app.mainRegion = new Marionette.Region({
  el: '#content',
});

app.on('start', function() {
  Backbone.history.start()
})

$(function() {
  app.start()
})
