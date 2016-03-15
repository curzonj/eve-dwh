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

create materialized view trade_hub_stats as (
with
cc as (select station_id, region_id, count(*) from market_order_changes group by station_id, region_id order by count desc limit 200),
sc as (select station_id, count(*), sum(price * volume_remaining) from market_orders where NOT buy group by station_id order by count desc limit 200),
bc as (select station_id, count(*), sum(price * volume_remaining) from market_orders where buy group by station_id order by count desc limit 200)

select "stationName" station_name, cc.station_id, cc.region_id, sc.count sell_orders, sc.sum sell_order_isk, bc.count buy_orders, bc.sum buy_order_isk, cc.count order_changes from cc join sc using (station_id) join "staStations" on ("stationID" = cc.station_id) join bc using (station_id)
);
