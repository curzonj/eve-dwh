CREATE TABLE IF NOT EXISTS market_order_snaps_y2016m04  (
    CHECK ( observed_at >= DATE '2016-04-01' AND observed_at < DATE '2016-05-01' )
) INHERITS (market_order_snaps);

CREATE TABLE IF NOT EXISTS zkillboard_data_y2016m04  (
    CHECK ( kill_time >= DATE '2016-04-01' AND kill_time < DATE '2016-05-01' )
) INHERITS (zkillboard_data);

CREATE TABLE IF NOT EXISTS market_order_changes_y2016m04  (
    CHECK ( observed_at >= DATE '2016-04-01' AND observed_at < DATE '2016-05-01' )
) INHERITS (market_order_changes);

CREATE TABLE IF NOT EXISTS market_order_stats_ts_y2016m04  (
    CHECK ( calculated_at >= DATE '2016-04-01' AND calculated_at < DATE '2016-05-01' )
) INHERITS (market_order_stats_ts);
