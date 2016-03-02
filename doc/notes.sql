
-- The query used to find all of a customer's orders
select

"m"."id", "m"."price", "m"."volume_entered", "m"."volume_remaining", "m"."station_id", "c"."character_id", "m"."region_id", "m"."buy",
"c2"."name" as "character_name", "s2"."stationName" as "station_name", "s"."buy_price_max", "s"."sell_price_min", "c"."type_id", "i"."typeName" as "type_name",

case when m.buy then round((s.sell_price_min * 0.985) - (s.buy_price_max * 1.0075), 2) else round((s.sell_price_min - 0.01) * 0.985 - (select p.cost from purchase_costs p where p.station_id = m.station_id and p.type_id = m.type_id), 2) end profit

from "character_order_details" as "c"
inner join "market_orders" as "m" on "c"."id" = "m"."id"
inner join "characters" as "c2" on "c"."character_id" = "c2"."character_id"
inner join "staStations" as "s2" on "s2"."stationID" = "c"."station_id"
inner join "invTypes" as "i" on "i"."typeID" = "c"."type_id"
inner join "station_order_stats" as "s" on "s"."region_id" = "c"."region_id" and "s"."type_id" = "c"."type_id" and "s"."station_id" = "c"."station_id"



-- some rough notes about calculating profit
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
