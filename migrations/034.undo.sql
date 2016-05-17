drop table user_account;
drop table eve_sso;
alter table eve_api_keys
  drop column user_account_id;
