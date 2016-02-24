delete from wallet_journal where entity_character = false;

alter table wallet_journal add column character_id bigint;

update wallet_journal set character_id = entity_id;

alter table wallet_journal drop column entity_id;
alter table wallet_journal drop column entity_character;
alter table wallet_journal alter column character_id set not null;

alter table wallet_journal ADD CONSTRAINT wallet_journal_pkey PRIMARY KEY (journal_ref_id);

alter table wallet_transactions drop column corporation_id;
alter table wallet_transactions add constraint wallet_transactions_character_id_fkey FOREIGN KEY (character_id) REFERENCES managed_characters(character_id);

