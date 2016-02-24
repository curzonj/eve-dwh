CREATE TABLE market_polling (
    type_id integer not null,
    region_id integer not null,

    orders_next_polling_at timestamptz,
    orders_polling_interval interval DAY TO MINUTE not null default interval '6 hour',
    history_next_polling_at timestamptz,
    history_polling_interval interval DAY TO MINUTE not null default interval '3 days',

    PRIMARY KEY(type_id, region_id)
);
