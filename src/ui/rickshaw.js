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
  }, {
    name: 'states',
    limit: 15,
    display: 'typeName',
    source: bloodhound,
  }).bind('typeahead:select', function(ev, suggestion) {
    loadTypeGraph(suggestion.typeID)
  })

  const palette = new Rickshaw.Color.Palette();

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
    const graph = $('#center_chart').data('graph')

    if (typeof graph !== 'undefined') {
      const size = calculateGraphSize()
      const sell_graph = $('#sell_chart').data('graph')
      const buy_graph = $('#buy_chart').data('graph')

      $('.chart_axis').css('top', size.height/8)

      graph.configure({
        width: size.width,
        height: size.height*0.75,
      })
      sell_graph.configure({
        width: size.width,
        height: size.height/8,
      })
      buy_graph.configure({
        width: size.width,
        height: size.height/8,
      })

      graph.render()
      sell_graph.render()
      buy_graph.render()
    }
  }

  const chart_html = require('./rickshaw.hbs')
  function loadTypeGraph(type_id) {
    $('h1.chart_loading').remove()
    $('div#content').append('<h1 class="chart_loading">Loading the chart data...</h1>')

    axios.get('/api/v1/types/'+type_id+'/market/stats', {
      params: {
        limit: '2 weeks',
        region_id: 10000002,
        station_id: 60003760,
        columns: [
          'buy_price_max',
          'buy_units_vol_chg',
          'buy_units_disappeared',
          'buy_units',
          'new_buy_order_units',
          'sell_price_min',
          'sell_units',
          'sell_units_vol_chg',
          'sell_units_disappeared',
          'new_sell_order_units',
        ].join(),
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

      const price_scale_type = (price_max / price_min) > 2 ? 'log' : 'linear'
      const price_scale = d3.scale[price_scale_type]().domain([price_min, price_max]).nice()

      const vol_min = _.reduce(response.data, (result, row) => {
        return Math.min(result, row.buy_units, row.sell_units)
      }, Number.MAX_VALUE)
      const vol_max = _.reduce(response.data, (result, row) => {
        return Math.max(result, row.buy_units, row.sell_units)
      }, Number.MIN_VALUE)

      const vol_scale_type = (vol_max / vol_min) > 2 ? 'log' : 'linear'
      const vol_scale = d3.scale[vol_scale_type]().domain([vol_min, vol_max]).nice()

      const size = calculateGraphSize()
      const graph = new Rickshaw.Graph({
        element: document.getElementById('center_chart'),
        width: size.width,
        height: size.height*0.75,
        renderer: 'line',
        stack: false,
        interpolation: 'step-after',
        series: [{
          name: 'buy_units',
          color: 'pink',
          scale: vol_scale,
          data: _.map(response.data, r => {
            return {
              x: r.unix_ts,
              y: r.buy_units,
            }
          }),
        }, {
          name: 'sell_units',
          color: 'orange',
          scale: vol_scale,
          data: _.map(response.data, r => {
            return {
              x: r.unix_ts,
              y: r.sell_units,
            }
          }),
        }, {
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
        }, ],
      })
      graph.update = _.debounce(_.bind(graph.update, graph), 100)

      const sell_units_data = _.map(response.data, r => {
        return {
          x: r.unix_ts,
          y: r.sell_units_vol_chg + r.sell_units_disappeared,
        }
      })
      const sell_graph = new Rickshaw.Graph({
        element: document.getElementById('sell_chart'),
        width: size.width,
        height: size.height/8,
        renderer: 'bar',
        stack: false,
        //interpolation: 'step-after',
        series: [{
          name: 'sell_units_sold',
          color: 'red',
          data: sell_units_data,
        }, {
          name: 'new_sell_order_units',
          color: 'green',
          data: _.map(response.data, r => {
            return {
              x: r.unix_ts,
              y: r.new_sell_order_units,
            }
          }),
        }, ],
      })
      const buy_graph = new Rickshaw.Graph({
        element: document.getElementById('buy_chart'),
        width: size.width,
        height: size.height/8,
        renderer: 'bar',
        stack: false,
        //interpolation: 'step-after',
        series: [{
          name: 'buy_units_sold',
          color: 'red',
          data: _.map(response.data, r => {
            return {
              x: r.unix_ts,
              y: r.buy_units_vol_chg + r.buy_units_disappeared,
            }
          }),
        }, {
          name: 'new_buy_order_units',
          color: 'green',
          data: _.map(response.data, r => {
            return {
              x: r.unix_ts,
              y: r.new_buy_order_units,
            }
          }),
        }, ],
      })
      const x_axis = new Rickshaw.Graph.Axis.Time({
        graph: graph,
      })
      $('#center_chart').css('left', '80px')
      $('#sell_chart').css('left', '80px')
      $('#buy_chart').css('left', '80px')
      $('#price_axis').css('left', '40px')
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
        graph: sell_graph,
      })
      new Rickshaw.Graph.HoverDetail({
        graph: buy_graph,
      })
      new Rickshaw.Graph.HoverDetail({
        graph: graph,
        formatter: function(series, x, y) {
          return series.name + ': ' + y.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,')
        },
      })

      graph.onUpdate(function() {
        sell_graph.window.xMin = graph.window.xMin
        sell_graph.window.xMax = graph.window.xMax
        buy_graph.window.xMin = graph.window.xMin
        buy_graph.window.xMax = graph.window.xMax
        sell_graph.render()
        buy_graph.render()
      })

      $('#center_chart').data('graph', graph)
      $('#sell_chart').data('graph', sell_graph)
      $('#buy_chart').data('graph', buy_graph)

      $('h1.chart_loading').remove()
      renderGraph()
    })
  }
}
