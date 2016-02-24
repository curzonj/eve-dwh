alter table wallet_journal add column entity_id bigint;
alter table wallet_journal add column entity_character boolean;

update wallet_journal set entity_id  = character_id, entity_character = true;

alter table wallet_journal alter column entity_id set not null;
alter table wallet_journal alter column entity_character set not null;
alter table wallet_journal drop column character_id;

ALTER TABLE wallet_journal DROP CONSTRAINT wallet_journal_pkey;
alter table wallet_journal ADD CONSTRAINT wallet_journal_pkey PRIMARY KEY (entity_character, entity_id, journal_ref_id);

alter table wallet_transactions add column corporation_id bigint;
alter table wallet_transactions drop constraint wallet_transactions_character_id_fkey;

alter table wallet_transactions drop constraint wallet_transactions_pkey;
alter table wallet_transactions add constraint wallet_transactions_pkey PRIMARY KEY (character_id, transaction_id);


