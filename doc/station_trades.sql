select
(select "typeName" from "invTypes" where "typeID" = type_id),
type_id, avg_quantity, margin, daily_sell_units, daily_buy_units, max_profit_per_unit, buy_price_max, sell_price_min

from agg_market_type_stats where
station_id = 60003760 and
-- select * from "invMarketGroups" where "parentGroupID" is null;
type_id NOT IN (select type_id from character_order_details join market_orders using (id, type_id, station_id) where station_id = 60003760 AND buy) AND
-- No manufacturing resources or SKINs
--type_id NOT IN (select "typeID" from type_metas where id_list && Array[475, 1954]) AND
ratio < 1.05 and

avg_quantity > 20 AND
daily_buy_units > 10 AND

buy_price_max < 900000000 AND
buy_price_max > 5000000 AND
margin > 0.05
order by max_profit_per_unit desc limit 25;
