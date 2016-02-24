truncate market_order_changes;
alter table market_order_changes
    add column buy boolean not null,
    add column canceled boolean,
    add column order_first_observed_at timestamptz not null;

DROP INDEX station_order_stats_i1;
CREATE INDEX station_order_stats_i1 on station_order_stats (type_id, region_id, station_id);

create table station_order_stats_ts (
    calculated_at timestamptz not null,
    last_updated_at timestamptz not null,
    type_id integer references "invTypes" ("typeID") not null,
    station_id integer references "staStations" ("stationID") not null,
    region_id integer references "mapRegions" ("regionID") not null,
    buy_price_max NUMERIC(16, 2),
    buy_price_wavg NUMERIC(16, 2),
    buy_price_5pct NUMERIC(16, 2),
    buy_price_median NUMERIC(16, 2),
    buy_units bigint,
    buy_orders_price_chg integer,
    buy_orders_vol_chg integer,
    buy_orders_disappeared integer,
    buy_units_vol_chg integer,
    buy_units_disappeared integer,
    buy_price_wavg_sold numeric(16,2),
    buy_price_min_sold numeric(16,2),
    buy_price_max_sold numeric(16,2),
    sell_price_min NUMERIC(16, 2),
    sell_price_wavg NUMERIC(16, 2),
    sell_price_5pct NUMERIC(16, 2),
    sell_price_median NUMERIC(16, 2),
    sell_units bigint,
    sell_orders_price_chg integer,
    sell_orders_vol_chg integer,
    sell_orders_disappeared integer,
    sell_units_vol_chg integer,
    sell_units_disappeared integer,
    sell_price_wavg_sold numeric(16,2),
    sell_price_min_sold numeric(16,2),
    sell_price_max_sold numeric(16,2),
    new_sell_orders integer,
    new_buy_orders integer,

    PRIMARY KEY (type_id, region_id, station_id, calculated_at)
);
