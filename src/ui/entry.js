'use strict';

global.orderNotificationsPage = require('./orders')
global.rickshawPage = function() {
  const Rickshaw = global.Rickshaw
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
    const palette = new Rickshaw.Color.Palette();
    const graph = new Rickshaw.Graph({
      element: document.getElementById('chart'),
      width: 1200,
      height: 600,
      renderer: 'line',
      offset: 'lines',
      series: [{
        name: 'buy_price_max',
        color: palette.color(),
        data: _.map(response.data, r => {
          return {
            x: r.unix_ts,
            y: r.buy_price_max,
          }
        }),
      }, {
        name: 'sell_price_min',
        color: palette.color(),
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
    var y_axis = new Rickshaw.Graph.Axis.Y({
      graph: graph,
      orientation: 'left',
      tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
      element: document.getElementById('y_axis'),
    });
    new Rickshaw.Graph.HoverDetail({
      graph: graph,
    })

    global.graph = graph

    graph.render()
  })
}
