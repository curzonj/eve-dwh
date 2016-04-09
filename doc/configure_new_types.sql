--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

with
faction_regions as (
  select "regionID" region_id from "mapRegions" where "factionID" IS NOT NULL AND "factionID" != 500005
),
selected_types as (
  select "typeID" type_id from "invTypes" where published AND "marketGroupID" in (select market_group_id from market_group_arrays where NOT id_list && Array[350001, 1849, 1659, 1396, 2] order by name_list)
)

insert into market_polling (type_id, region_id)
  select type_id, region_id from faction_regions join selected_types ON (1=1)
ON CONFLICT (type_id, region_id) DO NOTHING;

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

delete from market_polling where exists (select 1 from "invTypes" where "typeID" = market_polling.type_id and published = false);
