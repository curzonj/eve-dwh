'use strict';

const $ = require('jquery')
const Backbone = require('backbone')
const Marionette = require('backbone.marionette')
const Bloodhound = require('typeahead.js')

function buildTypeSearch(view) {
  view.$('#type-search input').typeahead({
    hint: true,
    highlight: true,
    minLength: 3,
  }, {
    name: 'states',
    limit: 15,
    display: 'typeName',
    source: new Bloodhound({
      datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
      queryTokenizer: Bloodhound.tokenizers.whitespace,
      remote: {
        url: '/api/v1/types/autocomplete?q=%QUERY',
        wildcard: '%QUERY',
      },
    }),
  }).bind('typeahead:select', function(ev, suggestion) {
    view.navigate({type_id: suggestion.typeID})
  })
}

function buildLocationSearch(view) {
  view.$('#location-search input').typeahead({
    hint: true,
    highlight: true,
    minLength: 3,
  }, {
    name: 'states',
    limit: 15,
    display: 'name',
    source: new Bloodhound({
      datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
      queryTokenizer: Bloodhound.tokenizers.whitespace,
      remote: {
        url: '/api/v1/locations/autocomplete?q=%QUERY',
        wildcard: '%QUERY',
      },
    }),
  }).bind('typeahead:select', function(ev, s) {
    if (s.stationID !== undefined) {
      view.navigate({
        station_id: s.stationID,
        region_id: s.regionID,
      })
    }
  })
}

module.exports = Marionette.ItemView.extend({
  template: require('./rickshaw_nav.hbs'),
  navigate: function(opts) {
    this.model.set(opts)
  },
  onRender: function(options) {
    buildTypeSearch(this)
    buildLocationSearch(this)
  },
})
