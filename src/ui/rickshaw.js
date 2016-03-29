'use strict';

module.exports = function() {
  const $ = global.$
  const Rickshaw = require('rickshaw')
  const d3 = require('d3')
  const _ = require('lodash')
  const axios = require('axios')
  const bluebird = require('bluebird')
  const querystring = require('querystring')

  const params = querystring.parse(window.location.hash.substr(1))
  const type_id = params.type_id || 34

  $('div#content').html(require('./rickshaw.hbs')())

  axios.get('/api/v1/types/'+type_id+'/market/stats', {
    params: {
      region_id: 10000002,
      station_id: 60003760,
      columns: 'buy_price_max,sell_price_min,buy_units,sell_units',
    },
  }).then(response => {
    const price_min = _.reduce(response.data, (result, row) => {
      return Math.min(result, row.buy_price_max)
    }, Number.MAX_VALUE)
    const price_max = _.reduce(response.data, (result, row) => {
      return Math.max(result, row.sell_price_min)
    }, Number.MIN_VALUE)
    const price_scale = d3.scale.linear().domain([price_min, price_max]).nice()
    const vol_min = _.reduce(response.data, (result, row) => {
      return Math.min(result, row.buy_units, row.sell_units)
    }, Number.MAX_VALUE)
    const vol_max = _.reduce(response.data, (result, row) => {
      return Math.max(result, row.buy_units, row.sell_units)
    }, Number.MIN_VALUE)
    const vol_scale = d3.scale.linear().domain([vol_min, vol_max]).nice()

    const palette = new Rickshaw.Color.Palette();
    const graph = new Rickshaw.Graph({
      element: document.getElementById('chart'),
      width: $(window).width() - 100,
      height: $(window).height() - 100,
      renderer: 'line',
      offset: 'lines',
      stack: false,
      interpolation: 'step-after',
      series: [{
        name: 'buy_price_max',
        color: 'lightblue',
        scale: price_scale,
        data: _.map(response.data, r => {
          return {
            x: r.unix_ts,
            y: r.buy_price_max,
          }
        }),
      }, {
        name: 'sell_price_min',
        color: 'steelblue',
        scale: price_scale,
        data: _.map(response.data, r => {
          return {
            x: r.unix_ts,
            y: r.sell_price_min,
          }
        }),
      }, {
        name: 'buy_units',
        color: palette.color(),
        scale: vol_scale,
        data: _.map(response.data, r => {
          return {
            x: r.unix_ts,
            y: r.buy_units,
          }
        }),
      }, {
        name: 'sell_units',
        color: palette.color(),
        scale: vol_scale,
        data: _.map(response.data, r => {
          return {
            x: r.unix_ts,
            y: r.sell_units,
          }
        }),
      }, ],
    })
    const x_axis = new Rickshaw.Graph.Axis.Time({
      graph: graph,
    })
    new Rickshaw.Graph.Axis.Y.Scaled({
      graph: graph,
      orientation: 'left',
      scale: price_scale,
      tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
      element: document.getElementById('price_axis'),
    })
    new Rickshaw.Graph.Axis.Y.Scaled({
      graph: graph,
      orientation: 'left',
      scale: vol_scale,
      tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
      element: document.getElementById('vol_axis'),
    })
    var slider = new Rickshaw.Graph.RangeSlider.Preview({
      graph: graph,
      element: document.querySelector('#slider'),
    })
    new Rickshaw.Graph.HoverDetail({
      graph: graph,
      formatter: function(series, x, y) {
        return y.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,')
      },
    })

    global.graph = graph

    function renderGraph() {
      graph.configure({
        width: $('#chart_container').width() - 80,
        height: ($(window).height() - 100)*0.833,
      });
      graph.render();
    }

    $('h1.chart_loading').remove()
    renderGraph()

    $(window).on('resize', renderGraph)
  })
}
