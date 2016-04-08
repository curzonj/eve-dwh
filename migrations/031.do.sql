drop materialized view stations_with_stats;
create materialized view stations_with_stats as (
  select distinct station_id, region_id from station_order_stats) UNION (select station_id, region_id from trade_hub_stats order by buy_orders desc limit 15
);
