create table market_daily_stats (
    date_of date not null,
    type_id integer not null,
    station_id integer not null,
    region_id integer not null,

    stats_timestamp integer[],
    buy_price_max NUMERIC(16, 2)[],
    buy_price_wavg NUMERIC(16, 2)[],
    buy_price_5pct NUMERIC(16, 2)[],
    buy_price_median NUMERIC(16, 2)[],
    buy_units bigint[],
    buy_orders_price_chg integer[],
    buy_orders_vol_chg integer[],
    buy_orders_disappeared integer[],
    buy_units_vol_chg bigint[],
    buy_units_disappeared bigint[],
    buy_price_wavg_sold numeric(16,2)[],
    buy_price_min_sold numeric(16,2)[],
    buy_price_max_sold numeric(16,2)[],
    sell_price_min NUMERIC(16, 2)[],
    sell_price_wavg NUMERIC(16, 2)[],
    sell_price_5pct NUMERIC(16, 2)[],
    sell_price_median NUMERIC(16, 2)[],
    sell_units bigint[],
    sell_orders_price_chg integer[],
    sell_orders_vol_chg integer[],
    sell_orders_disappeared integer[],
    sell_units_vol_chg bigint[],
    sell_units_disappeared bigint[],
    sell_price_wavg_sold numeric(16,2)[],
    sell_price_min_sold numeric(16,2)[],
    sell_price_max_sold numeric(16,2)[],
    new_sell_orders integer[],
    new_buy_orders integer[],
    new_sell_order_units bigint[],
    new_buy_order_units bigint[],

    hist_orders integer,
    hist_quantity bigint,
    hist_low NUMERIC(16, 2),
    hist_high NUMERIC(16, 2),
    hist_average NUMERIC(16, 2),

    PRIMARY KEY (type_id, region_id, station_id, date_of)
);

CREATE TABLE market_daily_stats_y2016m04 (
    CHECK ( date_of >= DATE '2016-04-01' AND date_of < DATE '2016-05-01' )
) INHERITS (market_daily_stats);
alter table market_daily_stats_y2016m04 add primary key (type_id, region_id, station_id, date_of);

CREATE TABLE market_daily_stats_y2016m03 (
    CHECK ( date_of < DATE '2016-04-01' )
) INHERITS (market_daily_stats);
alter table market_daily_stats_y2016m03 add primary key (type_id, region_id, station_id, date_of);


-- drop table historical_orders;
-- drop table market_history;
-- drop table if exists market_order_changes_y2016m03;
-- drop table if exists market_order_changes_y2016m04;
-- drop table if exists market_order_changes_s0;
-- drop table if exists market_order_changes;
-- drop table if exists market_order_stats_ts_y2016m03;
-- drop table if exists market_order_stats_ts_y2016m04;
-- drop table if exists market_order_stats_ts;
