-- market_group_arrays
create materialized view market_group_arrays as

with recursive g(market_group_id, parent_group_id, group_name, id_list, name_list) as (
    select "marketGroupID", "parentGroupID", "marketGroupName", ARRAY["marketGroupID"]::int[], ARRAY["marketGroupName"] from "invMarketGroups" where "parentGroupID" is null
      UNION
          select "marketGroupID", "parentGroupID", "marketGroupName", id_list || "marketGroupID"::int, name_list || "marketGroupName" from g, "invMarketGroups" where "parentGroupID" = market_group_id
)
select * from g;

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

create materialized view type_metas as

with max_metas as (
        select "parentTypeID", max(meta_level) max_meta from (select "typeID", "parentTypeID", (select COALESCE("valueInt", "valueFloat") from "dgmTypeAttributes", "invTypes" where "dgmTypeAttributes"."typeID" = "invTypes"."typeID" and "attributeID" = 633 and "dgmTypeAttributes"."typeID" = "invMetaTypes"."typeID" limit 1) as meta_level from "invMetaTypes" where "metaGroupID" = 1) a group by "parentTypeID"
)

select "typeID", "metaGroupID", "typeName", "marketGroupID", "parentTypeID", "metaGroupName", parent_group_id, group_name, id_list, name_list, (select COALESCE("valueInt", "valueFloat") from "dgmTypeAttributes" where "attributeID" = 633 and "dgmTypeAttributes"."typeID" = "invTypes"."typeID" limit 1) as meta_level, max_meta from "invTypes" left join "invMetaTypes" using ("typeID") left join "invMetaGroups" using ("metaGroupID") join market_group_arrays on ("marketGroupID" = market_group_id) left join max_metas using ("parentTypeID") where published;


--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

-- Takes 20 seconds
create materialized view trade_hub_stats as (
  with
    sc as (select station_id, region_id, count(*), sum(price * volume_remaining) from market_orders where NOT buy group by region_id, station_id order by count desc limit 150),
    bc as (select station_id, count(*), sum(price * volume_remaining) from market_orders where buy group by station_id order by count desc)

  select "stationName" station_name, "regionName" region_name, sc.station_id, sc.region_id, "solarSystemID" system_id, sc.count sell_orders, sc.sum sell_order_isk, bc.count buy_orders, bc.sum buy_order_isk
  from sc
  join "staStations" on ("stationID" = sc.station_id)
  join "mapRegions" on ("mapRegions"."regionID" = sc.region_id)
  left join bc using (station_id)
);

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

create materialized view stations_with_stats as (
  select distinct station_id, region_id from station_order_stats) UNION (select station_id, region_id from trade_hub_stats order by buy_orders desc limit 15
);

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

-- Takes 146 seconds
drop materialized view if exists observed_history;
create materialized view observed_history as
select type_id, station_id, region_id,
avg(day_buy_price_wavg_tx) as buy_price_wavg_sold,
avg(day_sell_price_wavg_tx) as sell_price_wavg_sold,
max(day_sell_order_price_changes) as daily_sell_isking,
max(day_buy_order_price_changes) as daily_buy_isking,
median(day_buy_units_tx) as daily_buy_units,
median(day_sell_units_tx) as daily_sell_units,
median(day_buy_orders_tx) as daily_buy_orders,
median(day_sell_orders_tx) as daily_sell_orders
from market_daily_stats where date_of >= (current_timestamp - interval '14 days') group by type_id, station_id, region_id;

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

drop view if exists agg_market_type_stats;
create view agg_market_type_stats as
select *,
((sell_price_min * 0.985) - (buy_price_max * 1.0075)) as max_profit_per_unit,
round((((sell_price_min * 0.985) - (buy_price_max * 1.0075)) / buy_price_max)::numeric, 2) as margin,
((least(sell_price_min, sell_price_wavg_sold) * 0.985) - (greatest(buy_price_max, buy_price_wavg_sold) * 1.0075)) as wavg_profit_per_unit

from station_order_stats
join order_frequencies using (type_id, region_id)
join observed_history using (type_id, station_id, region_id);

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

create materialized view recent_map_stats as
select region_id, system_id, sum(jumps) jumps, sum(ship_kills) ship_kills, sum(npc_kills) npc_kills from eve_map_stats where date_of > current_timestamp - interval '14 days' group by region_id, system_id;
