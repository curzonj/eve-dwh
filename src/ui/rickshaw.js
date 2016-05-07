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

function calculateGraphSize() {
  const width = $('#chart_container').width() - 80
  return {
    width: width,
    height: Math.min(width*0.5, ($(window).height() - 70)*0.80),
  }
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
    const data = _.sortBy(response.data.historical, 'unix_ts')

    if (_.isEmpty(data)) {
      view.ui.chart_loading.text('No data available for '+type_id)
      return
    }

    const price_min = _.reduce(data, (result, row) => {
      return Math.min(result, row.buy_price_max)
    }, Number.MAX_VALUE)
    const price_max = _.reduce(data, (result, row) => {
      return Math.max(result, row.sell_price_min)
    }, Number.MIN_VALUE)

    const price_scale_type = ((price_max / price_min) > 2 && price_min > 0) ? 'log' : 'linear'
    const price_scale = d3.scale[price_scale_type]().domain([price_min, price_max])
    /*if (price_scale_type === 'log')
      price_scale.nice() */

    const vol_min = _.reduce(data, (result, row) => {
      return Math.min(result, row.buy_units, row.sell_units)
    }, Number.MAX_VALUE)
    const vol_max = _.reduce(data, (result, row) => {
      return Math.max(result, row.buy_units, row.sell_units)
    }, Number.MIN_VALUE)

    const vol_scale_type = ((vol_max / vol_min) > 2 && vol_min > 0) ? 'log' : 'linear'
    const vol_scale = d3.scale[vol_scale_type]().domain([vol_min, vol_max])
    /*if (vol_scale_type === 'log')
      vol_scale.nice()*/

    const size = calculateGraphSize()
    const graph = new Rickshaw.Graph({
      element: view.ui.center_chart.get(0),
      width: size.width,
      height: size.height,
      renderer: 'line',
      stack: false,
      interpolation: 'step-after',
      series: [{
        name: 'buy_units',
        color: 'pink',
        scale: vol_scale,
        data: _.map(data, r => {
          return {
            x: r.unix_ts,
            y: r.buy_units,
          }
        }),
      }, {
        name: 'sell_units',
        color: 'orange',
        scale: vol_scale,
        data: _.map(data, r => {
          return {
            x: r.unix_ts,
            y: r.sell_units,
          }
        }),
      }, {
        name: 'buy_price_max',
        color: 'lightblue',
        scale: price_scale,
        data: _.compact(_.map(data, r => {
          if (_.isNumber(r.buy_price_max))
            return {
              x: r.unix_ts,
              y: r.buy_price_max,
            }
        })),
      }, {
        name: 'sell_price_min',
        color: 'steelblue',
        scale: price_scale,
        data: _.compact(_.map(data, r => {
          if (_.isNumber(r.sell_price_min))
            return {
              x: r.unix_ts,
              y: r.sell_price_min,
            }
        })),
      }, ],
    })

    const x_axis = new Rickshaw.Graph.Axis.Time({
      graph: graph,
    })

    view.ui.center_chart.css('left', '80px')
    view.ui.price_axis.css('left', '40px')

    new Rickshaw.Graph.Axis.Y.Scaled({
      graph: graph,
      orientation: 'left',
      scale: price_scale,
      tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
      element: view.ui.price_axis.get(0),
    })
    new Rickshaw.Graph.Axis.Y.Scaled({
      graph: graph,
      orientation: 'left',
      scale: vol_scale,
      grid: false,
      tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
      element: view.ui.vol_axis.get(0),
    })
    new Rickshaw.Graph.HoverDetail({
      graph: graph,
      formatter: function(series, x, y) {
        return series.name + ': ' + y.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,')
      },
    })

    view.ui.center_chart.data('graph', graph)
    view.ui.chart_loading.hide()
    renderGraph(view)
  })
}

function renderGraph(view) {
  const graph = view.ui.center_chart.data('graph')

  if (typeof graph !== 'undefined') {
    const size = calculateGraphSize()

    graph.configure({
      width: size.width,
      height: size.height,
    })

    graph.render()
  }
}

const ChartData = Backbone.Model.extend({

})

const ChartView = Marionette.ItemView.extend({
  template: require('./rickshaw.hbs'),
  ui: {
    center_chart: '#center_chart',
    vol_axis: '#vol_axis',
    price_axis: '#price_axis',
    chart_loading: 'h1.chart_loading',
  },
  initialize: function() {
    this.resizeHandle = _.bind(renderGraph, undefined, this)
    $(window).on('resize', this.resizeHandler)
  },
  onDestroy: function() {
    $(window).off('resize', this.resizeHandler)
  },
  onRender: function() {
    loadTypeGraph(this)
  },
})

module.exports = Marionette.LayoutView.extend({
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
    this.listenTo(this.model, 'change', this.modelEvents.change, this)

    this.nav_view = new ChartNav({ model: this.model })
  },
  onShow: function() {
    // Set this here so that it triggers a change, but only
    // after we've been rendered
    this.model.set({
      type_id: 34,
      region_id: 10000002,
      station_id:  60003760,
    })
  },
})
