'use strict';

global.orderNotificationsPage = require('./orders')
global.rickshawPage = function() {
  const Rickshaw = global.Rickshaw
  const d3 = global.d3
  const _ = require('lodash')
  const axios = require('axios')
  const bluebird = require('bluebird')
  const querystring = require('querystring')

  const params = querystring.parse(window.location.hash.substr(1))
  const type_id = params.type_id || 34
  console.log(params, window.location.hash)

  axios.get('/api/v1/types/'+type_id+'/market/stats', {
    params: {
      region_id: 10000002,
      station_id: 60003760,
      columns: 'buy_price_max,sell_price_min',
    },
  }).then(response => {
    const min = _.reduce(response.data, (result, row) => {
      return Math.min(result, row.buy_price_max)
    }, Number.MAX_VALUE)
    const max = _.reduce(response.data, (result, row) => {
      return Math.max(result, row.sell_price_min)
    }, Number.MIN_VALUE)
    const scale = d3.scale.linear().domain([min, max]).nice()

    const palette = new Rickshaw.Color.Palette();
    const graph = new Rickshaw.Graph({
      element: document.getElementById('chart'),
      width: 1200,
      height: 600,
      renderer: 'line',
      offset: 'lines',
      stack: false,
      interpolation: 'step-after',
      series: [{
        name: 'buy_price_max',
        color: palette.color(),
        scale: scale,
        data: _.map(response.data, r => {
          return {
            x: r.unix_ts,
            y: r.buy_price_max,
          }
        }),
      }, {
        name: 'sell_price_min',
        color: palette.color(),
        scale: scale,
        data: _.map(response.data, r => {
          return {
            x: r.unix_ts,
            y: r.sell_price_min,
          }
        }),
      }, ],
    })
    const x_axis = new Rickshaw.Graph.Axis.Time({
      graph: graph,
    })
    var y_axis = new Rickshaw.Graph.Axis.Y.Scaled({
      graph: graph,
      orientation: 'left',
      scale: scale,
      tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
      element: document.getElementById('y_axis'),
    });
    var slider = new Rickshaw.Graph.RangeSlider.Preview({
      graph: graph,
      element: document.querySelector('#slider'),
    })
    new Rickshaw.Graph.HoverDetail({
      graph: graph,
    })

    global.graph = graph

    graph.render()
  })
}
