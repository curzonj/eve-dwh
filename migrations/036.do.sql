create table planetary_observations (
  planet_id int not null,
  character_id bigint not null,
  last_updated_at timestamptz not null,
  observed_at timestamptz,
  observation_data jsonb not null,

  PRIMARY KEY(character_id, planet_id, last_updated_at)
)
