create table zkillboard_data (
  kill_id bigint not null,
  system_id integer not null,
  kill_time timestamptz not null,
  kill_data jsonb not null,
  primary key (kill_id)
)
