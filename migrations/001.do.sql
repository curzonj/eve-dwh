CREATE TABLE market_orders (
    id bigint PRIMARY KEY,
    first_observed_at timestamptz not null,
    observed_at timestamptz not null,
    price NUMERIC(16, 2) not null,
    volume_remaining bigint not null,
    volume_entered bigint not null,
    min_volume integer not null,
    buy boolean not null,
    disappeared_at timestamptz,
    issue_date timestamptz not null,
    duration integer not null,
    range integer not null,
    type_id integer not null,
    station_id integer not null,
    region_id integer not null
);

CREATE TABLE market_order_changes (
    order_id bigint not null,
    type_id integer not null,
    station_id integer not null,
    region_id integer not null,

    observed_at timestamptz not null,
    previously_observed_at timestamptz,

    issue_date timestamptz not null,
    previous_issue_date timestamptz,

    volume_remaining bigint not null,
    volume_delta bigint,

    price NUMERIC(16, 2) not null,
    previous_price NUMERIC(16, 2),

    PRIMARY KEY(order_id, issue_date, volume_remaining)
);

CREATE TABLE market_history (
    type_id integer not null,
    region_id integer not null,
    history_date date not null,
    orders integer not null,
    quantity bigint not null,
    low NUMERIC(16, 2) not null,
    high NUMERIC(16, 2) not null,
    average NUMERIC(16, 2) not null,

    PRIMARY KEY(type_id, region_id, history_date)
);
