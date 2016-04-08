
--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

drop materialized view if exists trade_hub_stats;
create materialized view trade_hub_stats as (
with
cc as (
  select station_id, region_id, sum(
    day_buy_order_price_changes +
    day_sell_order_price_changes +
    day_new_buy_orders +
    day_new_sell_orders +
    day_buy_orders_tx +
    day_sell_orders_tx
  ) count from market_daily_stats group by station_id, region_id order by count desc limit 100
),
sc as (select station_id, count(*), sum(price * volume_remaining) from market_orders where NOT buy group by station_id order by count desc limit 100),
bc as (select station_id, count(*), sum(price * volume_remaining) from market_orders where buy group by station_id order by count desc limit 100)

select "stationName" station_name, cc.station_id, cc.region_id, sc.count sell_orders, sc.sum sell_order_isk, bc.count buy_orders, bc.sum buy_order_isk, cc.count order_changes from sc join cc using (station_id) join "staStations" on ("stationID" = cc.station_id) join bc using (station_id)
);

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

drop materialized view if exists observed_history;
create materialized view observed_history as

select *,
(buy_isking / duration) as daily_buy_isking,
(sell_isking / duration) as daily_sell_isking,
(buy_units_tx / duration) as daily_buy_units,
(sell_units_tx / duration) as daily_sell_units,
(LEAST(buy_units_tx, sell_units_tx) / duration) as trade_units_tx
from
(
  select type_id, station_id,
  sum(sell_orders_price_chg) as sell_isking,
  sum(buy_orders_price_chg) as buy_isking,
  sum(buy_units_vol_chg + buy_units_disappeared) as buy_units_tx,
  sum(sell_units_vol_chg + sell_units_disappeared) as sell_units_tx,
  extract(day from (max(last_updated_at) - min(last_updated_at))) as duration
  from
  (
    select * from market_order_stats_ts where last_updated_at > '2000-01-01 00:00:01 -8:00'
  ) s2 group by type_id, station_id
) s1 where duration > 0;

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

drop materialized view if exists recent_observed_history;
create materialized view recent_observed_history as

select type_id, station_id,
count(*) as recent_observations,
avg(buy_price_wavg_sold) as buy_price_wavg_sold,
avg(sell_price_wavg_sold) as sell_price_wavg_sold
from
(
  select * from market_order_stats_ts where (now() - last_updated_at) < interval '5 days'
) s2 group by type_id, station_id;

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

drop view if exists agg_market_type_stats;
create view agg_market_type_stats as

select *,
((sell_price_min * 0.985) - (buy_price_max * 1.0075)) as max_profit_per_unit,
((least(sell_price_min, sell_price_wavg_sold) * 0.985) - (greatest(buy_price_max, buy_price_wavg_sold) * 1.0075)) as wavg_profit_per_unit,
trade_units_tx * (10 / greatest(10, daily_buy_isking, daily_sell_isking)) as est_market_share

from station_order_stats
join order_frequencies using (type_id, region_id)
join observed_history using (type_id, station_id)
join recent_observed_history using (type_id, station_id);
