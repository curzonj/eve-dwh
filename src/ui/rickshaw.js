'use strict';

const $ = require('jquery')
const Rickshaw = require('rickshaw')
const d3 = require('d3')
const _ = require('lodash')
const axios = require('axios')
const bluebird = require('bluebird')
const querystring = require('querystring')
const Backbone = require('backbone')
const Marionette = require('backbone.marionette')

const ChartNav = require('./chart_nav')

function extract(data, name) {
  return _.compact(_.map(data, r => {
    const v = r[name]
    if (_.isNumber(v))
      return { x: r.unix_ts, y: v }
  }))
}

function buildPriceChart(view, data) {
  const price_min = _.reduce(data, (result, row) => {
    return Math.min(
      result,
      row.buy_price_max || Number.MAX_VALUE,
      row.region_avg || Number.MAX_VALUE)
  }, Number.MAX_VALUE)
  const price_max = _.reduce(data, (result, row) => {
    return Math.max(result, row.sell_price_min, row.region_avg)
  }, Number.MIN_VALUE)

  const price_scale_type = ((price_max / price_min) > 2 && price_min > 0) ? 'log' : 'linear'
  const price_scale = d3.scale[price_scale_type]().domain([price_min, price_max])

  const size = view.calculateGraphSize()
  const graph = new Rickshaw.Graph({
    element: view.$('#price_chart').get(0),
    width: size.width,
    height: size.height,
    renderer: 'line',
    stack: false,
    //interpolation: 'step-after',
    series: [{
      name: 'buy_price_wavg',
      color: 'lightblue',
      scale: price_scale,
      data: extract(data, 'buy_price_max'),
    }, {
      name: 'sell_price_wavg',
      color: 'steelblue',
      scale: price_scale,
      data: extract(data, 'sell_price_min'),
    }, {
      name: 'region_avg',
      color: 'lightgreen',
      scale: price_scale,
      data: extract(data, 'region_avg'),
    }, ],
  })

  new Rickshaw.Graph.Axis.Time({
    graph: graph,
  })
  new Rickshaw.Graph.Axis.Y.Scaled({
    graph: graph,
    orientation: 'left',
    scale: price_scale,
    tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
    element: view.$('#price_axis').get(0),
  })
  new Rickshaw.Graph.HoverDetail({
    graph: graph,
    formatter: function(series, x, y) {
      return series.name + ': ' + y.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,')
    },
  })

  view.graphs.push(graph)
  return graph
}

function buildVolumeChart(view, data) {
  function convertEMA(name) {
    const span = 5 * 24 * 60 * 60 // 5 days
    var prevT
    var avg

    _.forEach(data, row => {
      const v = row[name]
      if (v === undefined || v === null)
        return

      if (avg === undefined) {
        avg = v
      } else {
        const a = 1 - (Math.exp(-(row.unix_ts - prevT) / span))
        avg = a * v + (1 - a) * avg;
      }

      prevT = row.unix_ts
      row[name] = avg
    })
  }

  convertEMA('region_units')

  const vol_min = _.reduce(data, (result, row) => {
    function or(v) { return (_.isNumber(v) ? v : Number.MAX_VALUE) }
    return Math.min(result, or(row.buy_units), or(row.sell_units), or(row.region_units))
  }, Number.MAX_VALUE)
  const vol_max = _.reduce(data, (result, row) => {
    return Math.max(result, row.buy_units, row.sell_units, row.region_units)
  }, Number.MIN_VALUE)

  const vol_scale_type = ((vol_max / vol_min) > 2 && vol_min > 0) ? 'log' : 'linear'
  const vol_scale = d3.scale[vol_scale_type]().domain([vol_min, vol_max])

  const size = view.calculateGraphSize()
  const graph = new Rickshaw.Graph({
    element: view.$('#vol_chart').get(0),
    width: size.width,
    height: size.height,
    renderer: 'line',
    stack: false,
    //interpolation: 'step-after',
    series: [{
      name: 'region_units_EMA',
      color: 'lightgreen',
      scale: vol_scale,
      data: extract(data, 'region_units'),
    }, {
      name: 'buy_units',
      color: 'orange',
      scale: vol_scale,
      data: extract(data, 'buy_units'),
    }, {
      name: 'sell_units',
      color: 'red',
      scale: vol_scale,
      data: extract(data, 'sell_units'),
    }, ],
  })

  new Rickshaw.Graph.Axis.Time({
    graph: graph,
  })

  new Rickshaw.Graph.Axis.Y.Scaled({
    graph: graph,
    orientation: 'left',
    scale: vol_scale,
    tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
    element: view.$('#vol_axis').get(0),
  })
  new Rickshaw.Graph.HoverDetail({
    graph: graph,
    formatter: function(series, x, y) {
      return series.name + ': ' + y.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,')
    },
  })

  view.graphs.push(graph)

  return graph
}

function loadTypeGraph(view) {
  const type_id = view.model.get('type_id')
  const region_id = view.model.get('region_id')
  const station_id = view.model.get('station_id')

  axios.get('/api/v1/types/'+type_id+'/market/stats', {
    params: {
      region_id: region_id,
      station_id: station_id,
    },
  }).then(response => {
    view.$el.append('<pre class="debug_json">'+JSON.stringify(response.data, null, 2)+'</pre>')
  })

  axios.get('/api/v1/types/'+type_id+'/market/buy_sell_series', {
    params: {
      region_id: region_id,
      station_id: station_id,
    },
  }).then(response => {
    var data = _.sortBy(response.data.historical, 'unix_ts')
    if (_.isEmpty(data)) {
      view.ui.chart_loading.text('No data available for '+type_id)
      return
    }

    buildPriceChart(view, data)
    buildVolumeChart(view, data)

    view.ui.chart_loading.hide()
    view.renderGraphs()
  })
}


const ChartData = Backbone.Model.extend({ })

const ChartView = Marionette.View.extend({
  template: require('./rickshaw.hbs'),
  ui: {
    chart_loading: 'h1.chart_loading',
  },
  initialize: function() {
    this.graphs = []
    this.resizeHandler = _.bind(this.renderGraphs, this)
    $(window).on('resize', this.resizeHandler)
  },
  calculateGraphSize: function() {
    const width = this.$el.width() - 80
    return {
      width: width,
      height: Math.min(width*0.5, ($(window).height() - 70)*0.80)/2,
    }
  },
  renderGraphs: function() {
    const size = this.calculateGraphSize()

    _.forEach(this.graphs, graph => {
      graph.configure({
        width: size.width,
        height: size.height,
      })

      graph.render()
    })
  },
  onDestroy: function() {
    $(window).off('resize', this.resizeHandler)
  },
  onRender: function() {
    loadTypeGraph(this)
  },
})

module.exports = Marionette.View.extend({
  template: () => '<div id="chart_container"></div>',
  regions: {
    chart: '#chart_container',
  },
  modelEvents: {
    change: function() {
      this.showChildView('chart', new ChartView({ model: this.model }))
    },
  },
  initialize: function() {
    this.model = new ChartData()
    this.nav_view = new ChartNav({ model: this.model })
  },
  onRender: function() {
    // Set this here so that it triggers a change, but only
    // after we've been rendered
    this.model.set({
      type_id: 34,
      region_id: 10000002,
      station_id:  60003760,
    })
  },
})
