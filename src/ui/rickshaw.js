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

  const chart_html = require('./rickshaw.hbs')

  $('div#per-page-navbar').html(require('./rickshaw_nav.hbs')())

  var type_id = 34
  var region_id = 10000002
  var station_id =  60003760

  $('#type-search input').typeahead({
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
    type_id = suggestion.typeID
    loadTypeGraph()
  })

  $('#location-search input').typeahead({
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
    console.log(s)

    if (s.stationID !== undefined) {
      station_id = s.stationID
      region_id = s.regionID
    }

    loadTypeGraph()
  })

  /*
  const params = querystring.parse(hash_querystring)
  const type_id = params.type_id || 34
  */
  loadTypeGraph()
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

      graph.configure({
        width: size.width,
        height: size.height,
      })

      graph.render()
    }
  }

  function loadTypeGraph() {
    $('div#content').html(chart_html())
    $('div#content').append('<h1 class="chart_loading">Loading the chart data...</h1>')

    axios.get('/api/v1/types/'+type_id+'/market/stats', {
      params: {
        region_id: region_id,
        station_id: station_id,
      },
    }).then(response => {
      $('div#content').append('<pre class="debug_json">'+JSON.stringify(response.data, null, 2)+'</pre>')
    })

    axios.get('/api/v1/types/'+type_id+'/market/buy_sell_series', {
      params: {
        limit: '4 weeks',
        region_id: region_id,
        station_id: station_id,
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

      const price_min = _.reduce(response.data, (result, row) => {
        return Math.min(result, row.buy_price_max)
      }, Number.MAX_VALUE)
      const price_max = _.reduce(response.data, (result, row) => {
        return Math.max(result, row.sell_price_min)
      }, Number.MIN_VALUE)

      const price_scale_type = ((price_max / price_min) > 2 && price_min > 0) ? 'log' : 'linear'
      const price_scale = d3.scale[price_scale_type]().domain([price_min, price_max])
      /*if (price_scale_type === 'log')
        price_scale.nice() */

      const vol_min = _.reduce(response.data, (result, row) => {
        return Math.min(result, row.buy_units, row.sell_units)
      }, Number.MAX_VALUE)
      const vol_max = _.reduce(response.data, (result, row) => {
        return Math.max(result, row.buy_units, row.sell_units)
      }, Number.MIN_VALUE)

      const vol_scale_type = ((vol_max / vol_min) > 2 && vol_min > 0) ? 'log' : 'linear'
      const vol_scale = d3.scale[vol_scale_type]().domain([vol_min, vol_max])
      /*if (vol_scale_type === 'log')
        vol_scale.nice()*/

      const size = calculateGraphSize()
      const graph = new Rickshaw.Graph({
        element: document.getElementById('center_chart'),
        width: size.width,
        height: size.height,
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
          data: _.compact(_.map(response.data, r => {
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
          data: _.compact(_.map(response.data, r => {
            if (_.isNumber(r.sell_price_min))
              return {
                x: r.unix_ts,
                y: r.sell_price_min,
              }
          })),
        }, ],
      })
      graph.update = _.debounce(_.bind(graph.update, graph), 30, { maxWait: 300 })

      const x_axis = new Rickshaw.Graph.Axis.Time({
        graph: graph,
      })
      $('#center_chart').css('left', '80px')
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
        graph: graph,
        formatter: function(series, x, y) {
          return series.name + ': ' + y.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,')
        },
      })

      $('#center_chart').data('graph', graph)

      $('h1.chart_loading').remove()
      renderGraph()
    })
  }
}
