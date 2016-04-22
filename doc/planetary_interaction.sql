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
  sum(quantity_price) as sum_cost
  from single_input_costs
  group by "schematicID" order by "schematicID"
),

input_prices AS (
  SELECT
  "typeID",
  "invTypes"."typeName",
  "invTypes"."marketGroupID",
  quantity,
  input_type_list,
  sum_cost input_costs,
  ((select sell_price_5pct from jita where type_id = a."typeID") * quantity) price,
  (((select sell_price_5pct from jita where type_id = a."typeID") * quantity) - sum_cost) profit
  FROM "planetSchematicsTypeMap" a
  JOIN "invTypes" USING ("typeID")
  JOIN grouped_input_costs USING ("schematicID")
  WHERE a."isInput" = false
),

p3_prices AS (
  SELECT
  "invTypes"."typeName",
  (select "typeName" from unnest(input_type_list) join input_prices on (unnest = "typeID") order by profit desc limit 1) as "AlsoBuildThisP2" ,

  sum_cost raw_cost,
  ((select buy_price_5pct from jita where type_id = a."typeID") * quantity) gross_revenue,
  (select profit from unnest(input_type_list) join input_prices on (unnest = "typeID") order by profit desc limit 1) sub_input_profit,

  (
    round(
    (
      0.07 * quantity *
      CASE (select "marketGroupID" from "invTypes" e where e."typeID" = a."typeID")
      WHEN 1336 THEN
        60000
      WHEN 1335 THEN
        7200
      WHEN 1334 THEN
        400
      END
    ) +
    (
      select sum("field1") from
      (
        with best_sub_item AS (
            (select * from unnest(input_type_list) join input_prices on (unnest = "typeID") order by profit desc limit 1)
        )

        select
        (
          CASE
          WHEN d."typeID" = (select "typeID" from best_sub_item) THEN
            (select (input_costs / quantity) * (select quantity from "planetSchematicsTypeMap" f where f."typeID" = d."typeID" AND f."schematicID" = d."schematicID") from best_sub_item)
          ELSE
            quantity_price
          END
        ) "field1"
        from unnest(input_type_list) join single_input_costs d on (unnest = d."typeID" AND d."schematicID" = a."schematicID")
      ) anon_table1
    ), 2)
  ) net_input_costs

  FROM "planetSchematicsTypeMap" a
  JOIN "invTypes" USING ("typeID")
  JOIN grouped_input_costs USING ("schematicID")
  WHERE a."isInput" = false AND "marketGroupID" = 1336
)

select "typeName", "AlsoBuildThisP2", (gross_revenue - raw_cost) raw_profit, (gross_revenue - net_input_costs) best_profit from p3_prices
where raw_cost < gross_revenue
order by raw_profit desc
;
