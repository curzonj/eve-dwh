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

-- Goblin's recommendation to only trade things that players can't manufacture
type_id in (
  select "typeID" from type_metas where
  (
    ("metaGroupID" = 4 or ("metaGroupID" = 1 and meta_level = max_meta)) and -- faction or max meta
    id_list && Array[9, 11] -- ammo or modules
  ) OR
  id_list && Array[27] -- implants
) AND

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------
-- Station trading. Search items by margin, volume, AND price

select
(select "typeName" from "invTypes" where "typeID" = type_id),
type_id, margin
least(est_market_share(5.0, daily_buy_orders, daily_buy_isking, daily_buy_units), est_market_share(5.0, daily_sell_orders, daily_sell_isking, daily_sell_units)) AS est_market_share,
round((wavg_profit_per_unit * ( least(est_market_share(5.0, daily_buy_orders, daily_buy_isking, daily_buy_units), est_market_share(5.0, daily_sell_orders, daily_sell_isking, daily_sell_units)) ))::numeric, 2) as profit_pot,

from agg_market_type_stats where
station_id = 60003760 and
-- select * from "invMarketGroups" where "parentGroupID" is null;
type_id NOT IN (select type_id from character_order_details join market_orders using (id, type_id, station_id) where station_id = 60003760 AND buy) AND
type_id NOT IN (select "typeID" from type_metas where id_list && Array[475, 1954]) AND
ratio < 1.2 and
avg_orders > 2 AND
daily_buy_units > 1 AND
buy_price_max < 900000000 AND
(max_profit_per_unit / buy_price_max) > 0.15
order by profit_pot desc limit 50;
