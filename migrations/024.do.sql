create table eve_map_stats (
  region_id integer not null,
  system_id integer not null,
  date_of date not null,
  hour integer not null,

  ship_kills integer,
  pod_kills integer,
  npc_kills integer,
  jumps integer,

  primary key (system_id, date_of, hour)
)
