alter table market_order_changes add column disappeared boolean not null default false;

create table market_change_conflicts (
    observed_at timestamptz not null default (now() at time zone 'utc'),
    crest_order jsonb not null,
    conflicting_row jsonb not null,
    previous_row jsonb
)
