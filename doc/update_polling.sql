
--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

with
faction_regions as (
  select "regionID" region_id from "mapRegions" where "factionID" IS NOT NULL AND "factionID" != 500005
),
selected_types as (
  select "typeID" type_id from "invTypes" where "marketGroupID" in (select market_group_id from market_group_arrays where NOT id_list && Array[350001, 1849, 1659, 1396, 2] order by name_list)
)

insert into market_polling (type_id, region_id)
  select type_id, region_id from faction_regions join selected_types ON (1=1)
ON CONFLICT (type_id, region_id) DO NOTHING;

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

delete from market_polling where exists (select 1 from "invTypes" where "typeID" = market_polling.type_id and published = false);

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

REFRESH MATERIALIZED VIEW order_frequencies;

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

update market_polling set

orders_polling_override = null,

history_polling_interval = COALESCE((
        case
                when f.ratio > 90 then interval '1 month'
                when f.ratio > 30 then interval '2 weeks'
                when f.ratio > 7 then interval '5 days'
                when f.ratio > 3 then interval '2 days'
                else interval '1 day'
        end
), interval '1 month'),

orders_polling_interval = COALESCE((
        case
                when f.ratio > 180 then interval '1 month'
                when f.ratio > 90 then interval '1 weeks'
                when f.ratio > 30 then interval '4 days'
                when f.ratio > 7 then interval '24 hours'
                when f.ratio > 2 then interval '9 hours'
                when f.avg_orders > 700 then interval '5 minutes'
                when f.avg_orders > 100 then interval '15 minutes'
                when f.avg_orders > 50 then interval '30 minutes'
                when f.avg_orders > 10 then interval '1 hours'
                else interval '3 hours'
        end
), interval '1 month')

from order_frequencies f where market_polling.type_id = f.type_id and market_polling.region_id = f.region_id;

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

update market_polling set orders_next_polling_at = current_timestamp + orders_polling_interval, history_next_polling_at = current_timestamp;
