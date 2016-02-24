alter table market_polling
        add column order_polling_started_at timestamptz not null default '2000-01-01 00:00:01 -8:00',
        add column history_polling_started_at timestamptz not null default '2000-01-01 00:00:01 -8:00',
        alter column orders_next_polling_at set default '2000-01-01 00:00:01 -8:00',
        alter column orders_next_polling_at set not null,
        alter column history_next_polling_at set default '2000-01-01 00:00:01 -8:00',
        alter column history_next_polling_at set not null;

drop index if exists market_polling_i2;
drop index if exists market_polling_i3;
