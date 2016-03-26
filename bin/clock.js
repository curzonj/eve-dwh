#!/usr/bin/env node

'use strict';

const sql = require('../src/sql')
const stats = require('../src/metrics').stats

setInterval(function() {
  sql('market_polling').
  whereRaw('orders_next_polling_at < now()').
  count('*').first().
  then(function(result) {
    stats.histogram('pending_market_orders').update(parseInt(result.count))
  })
}, 30000)
