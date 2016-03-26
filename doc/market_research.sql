select "typeID" from "invTypes" where "marketGroupID" in (select market_group_id from market_group_arrays where NOT id_list && Array[350001, 1954, 1849, 1659, 1396, 150, 2] order by name_list)

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

-- station trading
select
"typeName",
a.*,
order_frequencies.*
from (select type_id, coalesce(max(sell_price_wavg) - max(buy_price_max), 0) as profit from station_order_stats group by type_id order by profit desc) a

join "invTypes" on ("typeID" = type_id)
join order_frequencies on (order_frequencies.type_id = a.type_id and order_frequencies.region_id = 10000002)
join observed_history on (observed_history.type_id = a.type_id and observed_history.station_id = 60003760)
join recent_observed_history on (recent_observed_history.type_id = a.type_id and recent_observed_history.station_id = 60003760)

where a.type_id in (select "typeID" from type_metas where (("metaGroupID" = 4 or ("metaGroupID" = 1 and meta_level = max_meta)) and id_list && Array[9, 11]) OR id_list && Array[27])

AND avg_orders > 10

order by profit desc

;

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

select "typeName", s0.*
from
(
  select *,
  ((least(sell_price_min, sell_price_wavg_sold) * 0.985) - (greatest(buy_price_max, buy_price_wavg_sold) * 1.0075)) as profit_per_unit,
  (((least(sell_price_min, sell_price_wavg_sold) * 0.985) - (greatest(buy_price_max, buy_price_wavg_sold) * 1.0075)) * trade_units * (10 / greatest(10, daily_buy_isking, daily_sell_isking))) as profit_pot

  from station_order_stats
  join order_frequencies using (type_id, region_id)
  join observed_history using (type_id, station_id)
  join recent_observed_history using (type_id, station_id)

  where station_id = 60003760 and type_id in (select "typeID" from type_metas where (("metaGroupID" = 4 or ("metaGroupID" = 1 and meta_level = max_meta)) and id_list && Array[9, 11]) OR id_list && Array[27])
) s0
join "invTypes" on ("typeID" = type_id)
where ratio < 2 and buy_price_max < 10000000 and profit_pot > 1500000 order by profit_pot desc limit 50;

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

create materialized view observed_history as

select *,
(buy_isking / duration) as daily_buy_isking,
(sell_isking / duration) as daily_sell_isking,
(buy_units / duration) as daily_buy_units,
(sell_units / duration) as daily_sell_units,
(LEAST(buy_units, sell_units) / duration) as trade_units
from
(
  select type_id, station_id,
  count(*) as observations,
  sum(sell_orders_price_chg) as sell_isking,
  sum(buy_orders_price_chg) as buy_isking,
  sum(buy_units_vol_chg + buy_units_disappeared) as buy_units,
  sum(sell_units_vol_chg + sell_units_disappeared) as sell_units,
  extract(day from (max(last_updated_at) - min(last_updated_at))) as duration
  from
  (
    select * from station_order_stats_ts where last_updated_at > '2000-01-01 00:00:01 -8:00'
  ) s2 group by type_id, station_id
) s1 where duration > 0;

create materialized view recent_observed_history as

select type_id, station_id,
count(*) as observations,
avg(buy_price_wavg_sold) as buy_price_wavg_sold,
avg(sell_price_wavg_sold) as sell_price_wavg_sold
from
(
  select * from station_order_stats_ts where (now() - last_updated_at) < interval '5 days'
) s2 group by type_id, station_id;


select * from recent_observed_history where type_id = 35789 and station_id = 60003760;
