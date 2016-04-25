CREATE TABLE IF NOT EXISTS zkillboard_data_y2016m05  (
    CHECK ( kill_time >= DATE '2016-05-01' AND kill_time < DATE '2016-06-01' )
) INHERITS (zkillboard_data);

alter table zkillboard_data_y2016m05 add primary key (kill_id);

CREATE TABLE IF NOT EXISTS market_daily_stats_y2016m05  (
    CHECK ( date_of >= DATE '2016-05-01' AND date_of < DATE '2016-06-01' )
) INHERITS (market_daily_stats);

alter table market_daily_stats_y2016m05 add primary key (type_id, region_id, station_id, date_of);
