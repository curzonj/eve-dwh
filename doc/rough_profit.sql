with
buys as (select type_id, station_id, sum(price * quantity) / sum(quantity) as avg_price from wallet_transactions where buy group by type_id, station_id),
sells as (select type_id, station_id, sum(price * quantity) / sum(quantity) as avg_price, sum(quantity) as quantity from wallet_transactions where NOT buy group by type_id, station_id)

select "typeName", round(avg(sells.avg_price) - avg(buys.avg_price), 2) profit, round((avg(sells.avg_price) - avg(buys.avg_price)) * sum(sells.quantity), 2) as total_profit, sum(sells.quantity)

from buys join sells using (station_id, type_id) join "invTypes" on ("typeID" = buys.type_id) group by buys.type_id, "typeName" order by total_profit desc;
