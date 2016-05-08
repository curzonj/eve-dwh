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

const ChartData = Backbone.Model.extend({
  initialize: function() {
    this.listenTo(this, 'change', this.requestData);
  },
  requestData: function() {
    if (
      (_.has(this.changed, 'type_id') || _.has(this.changed, 'station_id')) &&
      !_.has(this.changed, 'requestState') // Don't trigger ourselves
    ) {
      const type_id = this.get('type_id')
      const region_id = this.get('region_id')
      const station_id = this.get('station_id')

      this.set({
        requestState: 'in_progress',
      })

      bluebird.all([
        axios.get('/api/v1/types/' + type_id + '/market/stats', {
          params: {
            region_id: region_id,
            station_id: station_id,
          },
        }).then(response => response.data),
        axios.get('/api/v1/types/' + type_id + '/market/buy_sell_series', {
          params: {
            region_id: region_id,
            station_id: station_id,
          },
        }).then(response => {
          var data = _.sortBy(response.data.historical, 'unix_ts')
          if (!_.isEmpty(data)) {
            var historical_done = false
            _.forEach(data, row => {
              if (row.sell_price_wavg !== null)
                historical_done = true
              if (historical_done)
                row.region_avg = null
            })
          }


          return {
            historical: data,
            recent: _.sortBy(response.data.recent, 'unix_ts'),
          }
        }),
      ]).spread((stats, timeseries) => {
        function convertSMA(data, name, period) {
          var list = []

          _.forEach(data, row => {
            const v = row[name]
            list.push(v)
            if (list.length > period)
              list.splice(0, 1)

            var sum = _.reduce(list, (acc, v) => {
              return acc + v
            })
            row[name] = sum / list.length
          })
        }

        convertSMA(timeseries.historical, 'region_units', 10)

        if (timeseries.recent.length > 1000) {
          convertSMA(timeseries.recent, 'buy_price_max', 4)
          convertSMA(timeseries.recent, 'sell_price_min', 4)
        }

        this.set({
          requestState: 'complete',
          stats: stats,
          historical: timeseries.historical,
          recent: timeseries.recent,
        })
      })
    }
  },
})

const ChartDashboard = Marionette.View.extend({
  template: require('./chart_dashboard.hbs'),
  initialize: function() {
    this.renderFuncs = []
    this.resizeHandler = _.bind(this.renderGraphs, this)
    $(window).on('resize', this.resizeHandler)
  },
  renderGraphs: function() {
    _.forEach(this.renderFuncs, (fn) => fn())
  },
  onDestroy: function() {
    $(window).off('resize', this.resizeHandler)
  },
  serializeModel: function() {
    return {
      stats: JSON.stringify(this.model.get('stats'), null, 2),
    }
  },
  buildChart: function(data, el, series) {
    function calculateGraphSize() {
      const width = el.width() - 80
      return {
        width: width,
        height: Math.min(width * 0.5, ($(window).height() - 70) * 0.80) / 2,
      }
    }

    function extract(name) {
      return _.compact(_.map(data, r => {
        const v = r[name]
        if (_.isNumber(v))
          return {
            x: r.unix_ts,
            y: v,
          }
      }))
    }
    const view = this
    const series_names = _.keys(series)
    const domain_min = _.reduce(data, (result, row) => {
      return Math.min.apply(Math, _.concat(_.map(series_names, n => {
        return row[n] || Number.MAX_VALUE
      }), result))
    }, Number.MAX_VALUE)
    const domain_max = _.reduce(data, (result, row) => {
      return Math.max.apply(Math, _.concat(_.map(series_names, n => {
        return row[n] || Number.MIN_VALUE
      }), result))
    }, Number.MIN_VALUE)

    const scale_type = ((domain_max / domain_min) > 2 && domain_min > 0) ? 'log' : 'linear'
    const scale = d3.scale[scale_type]().domain([domain_min, domain_max])

    const size = calculateGraphSize()
    const graph = new Rickshaw.Graph({
      element: $('.graph_body', el).get(0),
      width: size.width,
      height: size.height,
      renderer: 'line',
      stack: false,
      series: _.map(series, (value, key) => {
        return _.assign({
          scale: scale,
          data: extract(key),
        }, value)
      }),
    })

    function customTickFormat(y) {
      function rif(n) {
        if (Number.isInteger(y)) {
          return y
        } else {
          return y.toFixed(1)
        }
      }
      var abs_y = Math.abs(y);
      if (abs_y >= 1000000000000) {
        return y / 1000000000000 + 'T'
      } else if (abs_y >= 1000000000) {
        return y / 1000000000 + 'B'
      } else if (abs_y >= 1000000) {
        return y / 1000000 + 'M'
      } else if (abs_y >= 1000) {
        return y / 1000 + 'K'
      } else if (abs_y < 1 && y > 0) {
        return y.toFixed(2)
      } else if (abs_y === 0) {
        return ''
      } else {
        return rif(y)
      }
    }

    new Rickshaw.Graph.Axis.Time({
      graph: graph,
    })
    new Rickshaw.Graph.Axis.Y.Scaled({
      graph: graph,
      orientation: 'left',
      scale: scale,
      ticks: 4,
      tickFormat: customTickFormat,
      element: $('.chart_axis', el).get(0),
    })
    new Rickshaw.Graph.HoverDetail({
      graph: graph,
      formatter: function(series, x, y) {
        return series.name + ': ' + y.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,')
      },
    })

    this.renderFuncs.push(function() {
      const size = calculateGraphSize()

      graph.configure({
        width: size.width,
        height: size.height,
      })

      graph.render()
    })
  },
  onAttach: function() {
    const recent = this.model.get('recent')
    this.buildChart(recent,
      this.$('#day_charts .price.chart_container'), {
        buy_price_max: {
          name: 'Buy Price' + (recent.length > 1000 ? ' 20m SMA' : ''),
          color: 'lightblue',
        },
        sell_price_min: {
          name: 'Sell Price' + (recent.length > 1000 ? ' 20m SMA' : ''),
          color: 'steelblue',
        },
      })
    this.buildChart(recent,
      this.$('#day_charts .volume.chart_container'), {
        buy_units: {
          name: 'Buy Order Units',
          color: 'orange',
        },
        sell_units: {
          name: 'Sell Order Units',
          color: 'red',
        },
        region_units: {
          name: 'Region Quanity Sold',
          color: 'lightgreen',
        },
      })

    const historical = this.model.get('historical')
    this.buildChart(historical,
      this.$('#historical_charts .price.chart_container'), {
        buy_price_wavg: {
          name: 'Buy Order Price Wavg',
          color: 'lightblue',
        },
        sell_price_wavg: {
          name: 'Sell Order Price Wavg',
          color: 'steelblue',
        },
        region_avg: {
          name: 'Region Avg',
          color: 'lightgreen',
        },
      })

    this.buildChart(historical,
      this.$('#historical_charts .volume.chart_container'), {
        region_units: {
          name: 'Region Quantity 10d SMA',
          color: 'lightgreen',
        },
        buy_units: {
          name: 'Buy Order Units',
          color: 'orange',
        },
        sell_units: {
          name: 'Sell Order Units',
          color: 'red',
        },
      })

    this.renderGraphs()
  },
})

module.exports = Marionette.View.extend({
  template: require('./progress_loading.hbs'),
  regions: {
    contents: 'div',
  },
  ui: {
    chart_loading: 'h1.chart_loading',
  },
  modelEvents: {
    'change:requestState': function() {
      if (this.model.get('requestState') == 'in_progress') {
        this.ui.chart_loading.text('Loading the chart data...').show()
        this.getRegion('contents').empty()
      } else if (_.isEmpty(this.model.get('historical'))) {
        this.ui.chart_loading.text('No data available for ' + this.model.get('type_id')).show()
      } else {
        this.ui.chart_loading.hide()
        this.showChildView('contents', new ChartDashboard({
          model: this.model,
        }))
      }
    },
  },
  initialize: function() {
    this.model = new ChartData()
    this.nav_view = new ChartNav({
      model: this.model,
    })
  },
  onRender: function() {
    // Set this here so that it triggers a change, but only
    // after we've been rendered
    this.model.set({
      type_id: 34,
      region_id: 10000002,
      station_id: 60003760,
    })
  },
})
