WITH

jita AS (
  select * from station_order_stats where station_id = 60003760 and region_id = 10000002
),

single_input_costs AS (
 select
  b.*,
  ((
    sell_price_5pct + (
      0.07 * 0.5 *
      CASE (select "marketGroupID" from "invTypes" e where e."typeID" = b."typeID")
      WHEN 1336 THEN
        60000
      WHEN 1335 THEN
        7200
      WHEN 1334 THEN
        400
      END
    )
  )*quantity) quantity_price
  from "planetSchematicsTypeMap" b
  join jita on (type_id = "typeID")
  where "isInput" = true
),

grouped_input_costs AS (
 select
 "schematicID",
  array_agg("typeID") as input_type_list,
  count(*) as input_count,
  sum(quantity_price) as sum_cost
  from single_input_costs
  group by "schematicID" order by "schematicID"
),

profits AS (
  select
  (
    CASE "marketGroupID"
    WHEN 1336 THEN
      'P3 +++'
    WHEN 1335 THEN
      'P2 xx'
    END
  ) AS "Type",
  "invTypes"."typeName",
  quantity,
  input_count,
  ((select buy_price_5pct from jita where type_id = a."typeID") * quantity * 0.99) buy_order_revenue,
  ((select sell_price_min from jita where type_id = a."typeID") * quantity * 0.965) sell_order_revenue,
  sum_cost + round(
    0.07 * quantity *
    CASE "marketGroupID"
    WHEN 1336 THEN
      60000
    WHEN 1335 THEN
      7200
    WHEN 1334 THEN
      400
    END
  , 2) AS cost

  FROM "planetSchematicsTypeMap" a
  JOIN "invTypes" USING ("typeID")
  JOIN grouped_input_costs USING ("schematicID")
  WHERE a."isInput" = false AND "marketGroupID" in (1335, 1336)
)

select
input_count AS inputs,
"Type",
"typeName",
round(cost / quantity, 2) AS cost_per_unit,
round(buy_order_revenue - cost, 2) buy_order_profit,
round(buy_order_revenue / quantity, 2) buy_price,
round(sell_order_revenue - cost, 2) sell_order_profit,
round(sell_order_revenue / quantity, 2) sell_price,
round((buy_order_revenue - cost)*18*24, 2) daily_planet_profits
from profits
order by buy_order_profit desc;
