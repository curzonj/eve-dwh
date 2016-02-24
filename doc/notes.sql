select "typeName",
b.price b_price,
round(s.price * ((1 - 0.0075 - 0.015) / (1 + 0.0075)), 2) max_buy_offer_price,
s.price,
round(b.price * ((1 + 0.0075) / (1 - 0.0075 - 0.015)), 2) minimum_sell_offer_price
from "invTypes"
join best_station_buy b on ("invTypes"."typeID" = b.type_id AND b.station_id = 60003760)
join best_station_sell s on ("invTypes"."typeID" = s.type_id AND s.station_id = 60003760)
limit 50;

select "typeName",
round((s.price - b.price)/b.price, 4) margin,
(s.price - b.price) profit,
o.avg_quantity unit_volume,
o.avg_orders order_volume
from "invTypes"
join best_station_buy b on ("invTypes"."typeID" = b.type_id AND b.station_id = 60003760)
join best_station_sell s on ("invTypes"."typeID" = s.type_id AND s.station_id = 60003760)
join order_frequencies o on ("invTypes"."typeID" = o.type_id AND o.region_id = 10000002)
where o.avg_quantity > 200 and o.avg_orders > 20
order by margin desc
limit 50;

where exists (select 1 from market_polling where type_id = "invTypes"."typeID" and orders_polling_interval = interval '5 minutes' limit 1);

create materialized view best_station_buy as (select type_id, station_id, max(price) as price from market_orders where buy = true group by type_id, station_id);
create index best_station_buy_index on best_station_buy (type_id, station_id);
create materialized view best_station_sell as (select type_id, station_id, min(price) as price from market_orders where buy = sell group by type_id, station_id);
create index best_station_sell_index on best_station_sell (type_id, station_id);

0 <= (sell_price * (1 - 0.015)) - buy_price * (1.0075)
0 <= (sell_price * (0.985)) - buy_price * (1.0075)

0 <= (sell_price * (0.985)) - buy_price * (1.0075)
0 <= (sell_price * (0.985 / 1.0075)) - buy_price
buy_price <= (sell_price * (0.985 / 1.0075))

0 <= (sell_price * (0.985)) - buy_price * (1.0075)
0 <= buy_price * (-1.0075) + (sell_price * (0.985)) 
0 <= buy_price * (-1.0075 / 0.985) + sell_price
(-1) sell_price <= buy_price * (-1.0075 / 0.985)
sell_price >= buy_price * (1.0075 / 0.985)

S >= B * ((1 + 0.01) / (1 - 0.01 - 0.025))
S >= B * ((1.01) / (0.965))

B <= S * ((1 - 0.01 - 0.025) / (1 + 0.01))
B <= S * ((0.965) / (1.01))

X - X * (0.985/1.0075)
X + X * (-0.985/1.0075)
X * (1 - 0.985/1.0075)



round(((s.sell_price_min * 0.985) - (s.buy_price_max * 1.0075)) / s.sell_price_min, 2) profit_pct, round((s.sell_price_min * 0.985) - (s.buy_price_max * 1.0075), 2) profit, round(s.sell_price_min  - s.buy_price_max, 2) current_margin, round(s.sell_price_min * (1 - ((1 - 0.0075 - 0.015) / (1 + 0.0075))), 2) minimum_margin


select
"typeName",
o.avg_orders, o.avg_quantity,
s.buy_price_max,
round(((s.sell_price_min * 0.985) - (s.buy_price_max * 1.0075)) / s.sell_price_min, 2) profit_pct,
round((s.sell_price_min * 0.985) - (s.buy_price_max * 1.0075), 2) profit,
round(s.sell_price_min  - s.buy_price_max, 2) current_margin,
round(s.sell_price_min * (1 - ((1 - 0.0075 - 0.015) / (1 + 0.0075))), 2) minimum_margin

from station_order_stats AS s

join "invTypes" on ("typeID" = s.type_id)
join order_frequencies o using (type_id, region_id)

where avg_orders > 20 and avg_quantity > 200 and
buy_units > 0 and sell_units > 0 and
region_id = 10000002 and station_id = 60003760
and buy_price_max < 10000000 and buy_price_max > 200

order by profit_pct desc limit 100;
