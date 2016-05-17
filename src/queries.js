'use strict';

const sql = require('./sql')
const game = require('./game_constants')

module.exports = {
  character_order_details: function(account_id) {
    return sql('character_order_details AS c').
    innerJoin('market_orders AS m', 'c.id', 'm.id').
    innerJoin('characters AS c2', 'c.character_id', 'c2.character_id').
    innerJoin('staStations AS s2', 's2.stationID', 'c.station_id').
    innerJoin('invTypes AS i', 'i.typeID', 'c.type_id').
    innerJoin('station_order_stats AS s', function() {
      this.on('s.region_id', '=', 'c.region_id').andOn('s.type_id', '=', 'c.type_id').andOn('s.station_id', '=', 'c.station_id')
    }).
    where(sql.raw('c.character_id IN (select unnest(character_id_list) from user_accounts where id = ?)', account_id)).
    select('m.id', 'm.price', 'm.volume_entered', 'm.volume_remaining', 'm.station_id', 'c.character_id', 'm.region_id', 'm.buy', 'c2.name AS character_name', 's2.stationName AS station_name', 's.buy_price_max', 's.sell_price_min', 'c.type_id', 'i.typeName AS type_name',
      sql.raw('case when m.buy then (s.buy_price_max - m.price) else (m.price - s.sell_price_min) end AS price_change'),
      sql.raw('case when m.buy then round((s.sell_price_min * '+game.pct_sell+') - (s.buy_price_max * '+game.pct_buy+'), 2) else round((s.sell_price_min - 0.01) * '+game.pct_sell+' - (select p.cost from purchase_costs p where p.station_id = m.station_id and p.type_id = m.type_id), 2) end AS market_profit'),
      sql.raw('case when m.buy then null else (select p.cost from purchase_costs p where p.station_id = m.station_id and p.type_id = m.type_id) end AS cost'),
      sql.raw('case when m.buy then round((s.sell_price_min * '+game.pct_sell+') - (m.price * '+game.pct_buy+'), 2) else round((m.price - 0.01) * '+game.pct_sell+' - (select p.cost from purchase_costs p where p.station_id = m.station_id and p.type_id = m.type_id), 2) end AS current_profit')
    )
  },
}
