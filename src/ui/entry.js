'use strict';

const $ = require('jquery')
const Backbone = require('backbone')
const Marionette = require('backbone.marionette')

const app = new Marionette.Application()
global.App = app

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
})
app.navRegion = new Marionette.Region({
  el: '#per-page-navbar',
})

// mn3 region callback
function mn3rc(fn) {
  return function(a1, a2, a3) {
    if (typeof a1.render === 'function') {
      return fn(a2, a1, a3)
    } else {
      return fn(a1, a2, a3)
    }
  }
}

app.mainRegion.on('show', mn3rc(function(region, view, options) {
  if (view.nav_view)
    App.navRegion.show(view.nav_view)
}))
app.mainRegion.on('before:swapOut', mn3rc(function(region, view, opts) {
  app.navRegion.empty()
}))

app.on('start', function() {
  Backbone.history.start()
})

$(function() {
  app.start()
})
