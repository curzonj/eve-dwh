create table user_accounts (
  id serial primary key,
  character_id_list bigint[] not null default array[]::bigint[],
  corporation_id_list bigint[] not null default array[]::bigint[]
);

create table eve_sso (
  character_id bigint not null,
  user_account_id integer not null  REFERENCES user_accounts (id)
);

alter table eve_api_keys
  add column user_account_id integer;
