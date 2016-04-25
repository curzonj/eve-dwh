WITH

jita as (
  select * from agg_market_type_stats where region_id = 10000002 and station_id = 60003760
)

select
(select "typeName" from "invTypes" where "typeID" = type_id),
(select "stationName" from "staStations" where "stationID" = hub.station_id),
round(((hub.sell_price_min - jita.sell_price_min) * est_market_share(3, hub.daily_sell_orders::numeric, hub.daily_sell_isking::numeric, hub.daily_sell_units::numeric)), 0) AS funny,
hub.avg_orders,
hub.daily_sell_units,
hub.daily_sell_isking,
jita.sell_price_min jita_sell,
hub.sell_price_min hub_sell,
round((hub.sell_price_min - jita.sell_price_min) / jita.sell_price_min, 2) AS hub_margin

from agg_market_type_stats hub
join jita using (type_id)
where

-- Amarr, Dodixie, Rens, Hek, Stacmon
hub.station_id in (60008494, 60011866, 60004588, 60005686, 60011893) AND
hub.daily_sell_isking <= 10 AND
hub.ratio < 1.2 and
hub.avg_orders > 2 AND
hub.daily_buy_units > 1 AND
jita.sell_price_min < 10000000 AND
hub.sell_price_min > jita.sell_price_min * 1.2 AND
-- No manufacturing resources or SKINs
type_id NOT IN (select "typeID" from type_metas where id_list && Array[475, 1954])

order by funny desc

limit 300;
