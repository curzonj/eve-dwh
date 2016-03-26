drop table market_order_snaps_y2016m03;
drop table market_order_snaps;

ALTER TABLE market_order_changes_y2016m03 NO INHERIT market_order_changes;
ALTER TABLE market_order_changes_y2016m03 drop constraint y2016m03;
DROP TABLE market_order_changes;
ALTER TABLE market_order_changes_y2016m03 rename to market_order_changes;

ALTER TABLE zkillboard_data_y2016m03 NO INHERIT zkillboard_data;
ALTER TABLE zkillboard_data_y2016m03 drop constraint y2016m03;
DROP TABLE zkillboard_data;
ALTER TABLE zkillboard_data_y2016m03 rename to zkillboard_data;

ALTER TABLE market_order_stats_ts_y2016m03 NO INHERIT market_order_stats_ts;
ALTER TABLE market_order_stats_ts_y2016m03 drop constraint y2016m03;
DROP TABLE market_order_stats_ts;
ALTER TABLE market_order_stats_ts_y2016m03 rename to station_order_stats_ts;

alter table station_order_stats_ts
  add column buy_order_data jsonb,
  add column sell_order_data jsonb;
