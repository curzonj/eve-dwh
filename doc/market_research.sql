select "typeName", s0.*
from
(
select *, ((least(sell_price_min, sell_price_wavg_sold) * 0.985) - (greatest(buy_price_max, buy_price_wavg_sold) * 1.0075)) as profit_per_unit, (((least(sell_price_min, sell_price_wavg_sold) * 0.985) - (greatest(buy_price_max, buy_price_wavg_sold) * 1.0075)) * trade_units * (8 / greatest(8, daily_buy_isking, daily_sell_isking))) as profit_pot from station_order_stats join order_frequencies using (type_id, region_id) join observed_history using (type_id, station_id) join recent_observed_history using (type_id, station_id) where station_id = 60003760 and type_id in (select "typeID" from type_metas where (("metaGroupID" = 4 or ("metaGroupID" = 1 and meta_level in (max_meta, max_meta - 1))) and id_list && Array[9, 11]) OR id_list && Array[27])
) s0
join "invTypes" on ("typeID" = type_id)
where ratio < 2 and buy_price_max < 10000000 and profit_pot > 1500000 order by profit_pot desc limit 50;

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
