create table industry_jobs (
  job_id bigint primary key,
  installer_id bigint not null,
  activity_id int not null,
  blueprint_type_id bigint not null,
  start_date timestamptz not null,
  completed_date timestamptz,
  job_data jsonb not null
)
