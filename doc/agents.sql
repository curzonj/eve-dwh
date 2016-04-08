select * from (
  select "mapConstellations"."constellationName", "itemName", count(*) a_count, sum(kills) sum_k, max("mapSolarSystems".security) max_sec, array_agg("mapSolarSystems"."solarSystemName") as systems
  from "agtAgents"
  join "staStations" on ("locationID" = "stationID")
  join "mapSolarSystems" using ("solarSystemID")
  join "mapConstellations" on ("mapConstellations"."constellationID" = "mapSolarSystems"."constellationID")
  join (select system_id, avg(ship_kills) as kills from eve_map_stats group by system_id) k on (system_id = "staStations"."solarSystemID")
  join "invNames" on ("itemID" = "agtAgents"."corporationID")
  where
  level = 4 AND "divisionID" = 24 AND
  "mapSolarSystems"."constellationID" IN (select "constellationID" from (select "constellationID", min(security) as min_sec from "mapSolarSystems" group by "constellationID") a where min_sec > 0.5)

  group by "mapConstellations"."constellationName", "itemName"
) a where a_count >= 2 order by sum_k asc;
