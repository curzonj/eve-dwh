create table market_order_snaps (
  observed_at timestamptz not null,
  region_id integer not null,
  type_id integer not null,
  buy_order_data jsonb not null,
  sell_order_data jsonb not null,

  primary key (observed_at, region_id, type_id)
);

CREATE TABLE market_order_snaps_y2016m03 (
    CHECK ( observed_at < DATE '2016-04-01' )
) INHERITS (market_order_snaps);

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

ALTER TABLE market_order_changes rename to market_order_changes_y2016m03;
CREATE TABLE market_order_changes (LIKE market_order_changes_y2016m03 INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE market_order_changes_y2016m03 ADD CONSTRAINT y2016m03
   CHECK ( observed_at < DATE '2016-04-01' );
ALTER TABLE market_order_changes_y2016m03 INHERIT market_order_changes;

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

ALTER TABLE zkillboard_data rename to zkillboard_data_y2016m03;
CREATE TABLE zkillboard_data (LIKE zkillboard_data_y2016m03 INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE zkillboard_data_y2016m03 ADD CONSTRAINT y2016m03
   CHECK ( kill_time < DATE '2016-04-01' );
ALTER TABLE zkillboard_data_y2016m03 INHERIT zkillboard_data;

--------------------------------- --------------------------------- ---------------------------------
--------------------------------- --------------------------------- ---------------------------------

ALTER TABLE station_order_stats_ts
  drop column buy_order_data,
  drop column sell_order_data;

ALTER TABLE station_order_stats_ts rename to market_order_stats_ts_y2016m03;
CREATE TABLE market_order_stats_ts (LIKE market_order_stats_ts_y2016m03 INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE market_order_stats_ts_y2016m03 ADD CONSTRAINT y2016m03
   CHECK ( calculated_at < DATE '2016-04-01' );
ALTER TABLE market_order_stats_ts_y2016m03 INHERIT market_order_stats_ts;
