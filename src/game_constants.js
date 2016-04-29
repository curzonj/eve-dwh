'use strict';

const game = module.exports = {
  tritanium_id: 34,
  the_forge_id: 10000002,
  jita_station_id: 60003760,

  // You also need to update the agg_market_type_stats view
  brokers_fee: 0.03,
  tax_rate: 0.01,
}

game.pct_sell = 1 - game.tax_rate - game.brokers_fee
game.pct_buy = 1 + game.brokers_fee
