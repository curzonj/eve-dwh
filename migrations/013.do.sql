CREATE TABLE metric_observations (
    hostname varchar(255) not null,
    updated_at timestamptz not null,
    proc_type varchar(255) not null,
    metrics jsonb not null
)
