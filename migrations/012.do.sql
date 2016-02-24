create materialized view trade_hub_stats as (
with
cc as (select station_id, region_id, count(*) from market_order_changes group by station_id, region_id order by count desc limit 100),
sc as (select station_id, count(*), sum(price * volume_remaining) from market_orders where NOT buy group by station_id order by count desc limit 100),
bc as (select station_id, count(*), sum(price * volume_remaining) from market_orders where buy group by station_id order by count desc limit 100)

select "stationName" station_name, cc.station_id, cc.region_id, sc.count sell_orders, sc.sum sell_order_isk, bc.count buy_orders, bc.sum buy_order_isk, cc.count order_changes from cc join sc using (station_id) join "staStations" on ("stationID" = cc.station_id) join bc using (station_id)
);

create table station_order_stats (
    type_id integer references "invTypes" ("typeID") not null,
    station_id integer references "staStations" ("stationID") not null,
    region_id integer references "mapRegions" ("regionID") not null,
    updated_at timestamptz,
    buy_price_max NUMERIC(16, 2),
    buy_price_wavg NUMERIC(16, 2),
    buy_price_5pct NUMERIC(16, 2),
    buy_price_median NUMERIC(16, 2),
    buy_units bigint,
    sell_price_min NUMERIC(16, 2),
    sell_price_wavg NUMERIC(16, 2),
    sell_price_5pct NUMERIC(16, 2),
    sell_price_median NUMERIC(16, 2),
    sell_units bigint
);

with interesting_types as (select distinct type_id from market_polling)
insert into station_order_stats (station_id, region_id, type_id) select station_id, region_id, type_id from trade_hub_stats join interesting_types on (true);
