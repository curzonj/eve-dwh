'use strict';

const sql = require('./sql')

module.exports = {
  character_order_details: function(table_pre) {
    return sql('character_order_details AS c').
    innerJoin(table_pre + '_orders AS m', 'c.id', 'm.id').
    innerJoin('characters AS c2', 'c.character_id', 'c2.character_id').
    innerJoin('staStations AS s2', 's2.stationID', 'c.station_id').
    innerJoin('invTypes AS i', 'i.typeID', 'c.type_id').
    innerJoin('station_order_stats AS s', function() {
      this.on('s.region_id', '=', 'c.region_id').andOn('s.type_id', '=', 'c.type_id').andOn('s.station_id', '=', 'c.station_id')
    }).
    select('m.id', 'm.price', 'm.volume_entered', 'm.volume_remaining', 'm.station_id', 'c.character_id', 'm.region_id', 'm.buy', 'c2.name AS character_name', 's2.stationName AS station_name', 's.buy_price_max', 's.sell_price_min', 'c.type_id', 'i.typeName AS type_name',
      sql.raw('case when m.buy then (s.buy_price_max - m.price) else (m.price - s.sell_price_min) end AS price_change'),
      sql.raw('case when m.buy then round((s.sell_price_min * 0.985) - (s.buy_price_max * 1.0075), 2) else round((s.sell_price_min - 0.01) * 0.985 - (select p.cost from purchase_costs p where p.station_id = m.station_id and p.type_id = m.type_id), 2) end AS market_profit'),
      sql.raw('case when m.buy then round((s.sell_price_min * 0.985) - (m.price * 1.0075), 2) else round((m.price - 0.01) * 0.985 - (select p.cost from purchase_costs p where p.station_id = m.station_id and p.type_id = m.type_id), 2) end AS current_profit')
    )
  },
}
