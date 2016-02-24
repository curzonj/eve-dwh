truncate character_order_details;
alter table character_order_details add column issued_at timestamptz not null;
