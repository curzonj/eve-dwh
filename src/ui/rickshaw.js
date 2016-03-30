'use strict';

module.exports = function(hash_querystring) {
  const $ = require('jquery')
  const Rickshaw = require('rickshaw')
  const d3 = require('d3')
  const _ = require('lodash')
  const axios = require('axios')
  const bluebird = require('bluebird')
  const querystring = require('querystring')
  const Bloodhound = require('typeahead.js')

  $('div#per-page-navbar').html(require('./rickshaw_nav.hbs')())

  const bloodhound = new Bloodhound({
    datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
    queryTokenizer: Bloodhound.tokenizers.whitespace,
    remote: {
      url: '/api/v1/types/autocomplete?q=%QUERY',
      wildcard: '%QUERY',
    },
  });

  $('#type-search input').typeahead({
    hint: true,
    highlight: true,
    minLength: 3,
  },
  {
    name: 'states',
    limit: 15,
    display: 'typeName',
    source: bloodhound,
  })

  $('#type-search input').bind('typeahead:select', function(ev, suggestion) {
    loadTypeGraph(suggestion.typeID)
  })

  /*
  const params = querystring.parse(hash_querystring)
  const type_id = params.type_id || 34
  */
  loadTypeGraph(34)
  $(window).on('resize', renderGraph)

  function calculateGraphSize() {
    const width = $('#chart_container').width() - 80
    return {
      width: width,
      height: Math.min(width*0.5, ($(window).height() - 70)*0.80),
    }
  }

  function renderGraph() {
    const graph = $('#chart').data('graph')

    if (typeof graph !== 'undefined') {
      const size = calculateGraphSize()

      graph.configure({
        width: size.width,
        height: size.height,
      });
      graph.render();
    }
  }

  const chart_html = require('./rickshaw.hbs')
  function loadTypeGraph(type_id) {
    $('h1.chart_loading').remove()
    $('div#content').append('<h1 class="chart_loading">Loading the chart data...</h1>')

    axios.get('/api/v1/types/'+type_id+'/market/stats', {
      params: {
        region_id: 10000002,
        station_id: 60003760,
        columns: 'buy_price_max,sell_price_min,buy_units,sell_units',
      },
    }).then(response => {
      if (_.isEmpty(response.data)) {
        $('h1.chart_loading').text('No data available for '+type_id)
        return
      }

      $('div#content').html(chart_html())

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

      const size = calculateGraphSize()
      const palette = new Rickshaw.Color.Palette();
      const graph = new Rickshaw.Graph({
        element: document.getElementById('chart'),
        width: size.width,
        height: size.height,
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
        grid: false,
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

      $('#chart').data('graph', graph)

      $('h1.chart_loading').remove()
      renderGraph()
    })
  }
}
