--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

-- Regional trading

select "typeName", (amarr.sell_price_min - jita.sell_price_min) / jita.sell_price_min as pprofit, (amarr.sell_price_min - jita.sell_price_min) as profit_isk, amarr.*, 666, jita.*

from "invTypes" t

join station_order_stats jita on (t."typeID" = jita.type_id AND jita.station_id = 60003760)
join station_order_stats amarr on (t."typeID" = amarr.type_id AND amarr.station_id = 60008494)

join order_frequencies on (order_frequencies.type_id = amarr.type_id and order_frequencies.region_id = 10000043)
join observed_history on (observed_history.type_id = amarr.type_id and observed_history.station_id = 60008494)
join recent_observed_history on (recent_observed_history.type_id = amarr.type_id and recent_observed_history.station_id = 60008494)

where

-- amarr.type_id in (select "typeID" from type_metas where (("metaGroupID" = 4 or ("metaGroupID" = 1 and meta_level = max_meta)) and id_list && Array[9, 11]) OR id_list && Array[27]) -- modules, ammo, implants

 avg_orders > 10
AND daily_sell_units > 10
AND amarr.sell_orders > 0
AND jita.sell_orders > 0
AND jita.sell_price_min > 5000000

order by pprofit desc

limit 20

;

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

select "typeName", s0.*
from
(
  select *, wavg_profit_per_unit * est_market_share as profit_pot from agg_market_type_stats

  where station_id = 60003760 and type_id in (select "typeID" from type_metas where (("metaGroupID" = 4 or ("metaGroupID" = 1 and meta_level = max_meta)) and id_list && Array[9, 11]) OR id_list && Array[27])
) s0
join "invTypes" on ("typeID" = type_id)
where ratio < 2 and buy_price_max < 10000000 and profit_pot > 1500000 order by profit_pot desc limit 50;

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------
