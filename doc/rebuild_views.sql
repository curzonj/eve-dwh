-- market_group_arrays
create materialized view market_group_arrays as

with recursive g(market_group_id, parent_group_id, group_name, id_list, name_list) as (
    select "marketGroupID", "parentGroupID", "marketGroupName", ARRAY["marketGroupID"]::int[], ARRAY["marketGroupName"] from "invMarketGroups" where "parentGroupID" is null
      UNION
          select "marketGroupID", "parentGroupID", "marketGroupName", id_list || "marketGroupID"::int, name_list || "marketGroupName" from g, "invMarketGroups" where "parentGroupID" = market_group_id
)
select * from g;

-- type_metas
create materialized view type_metas as

with max_metas as (
        select "parentTypeID", max(meta_level) max_meta from (select "typeID", "parentTypeID", (select COALESCE("valueInt", "valueFloat") from "dgmTypeAttributes", "invTypes" where "dgmTypeAttributes"."typeID" = "invTypes"."typeID" and "attributeID" = 633 and "dgmTypeAttributes"."typeID" = "invMetaTypes"."typeID" limit 1) as meta_level from "invMetaTypes" where "metaGroupID" = 1) a group by "parentTypeID"
)

select "typeID", "metaGroupID", "typeName", "marketGroupID", "parentTypeID", "metaGroupName", parent_group_id, group_name, id_list, name_list, (select COALESCE("valueInt", "valueFloat") from "dgmTypeAttributes" where "attributeID" = 633 and "dgmTypeAttributes"."typeID" = "invTypes"."typeID" limit 1) as meta_level, max_meta from "invTypes" left join "invMetaTypes" using ("typeID") left join "invMetaGroups" using ("metaGroupID") join market_group_arrays on ("marketGroupID" = market_group_id) left join max_metas using ("parentTypeID") where published;
