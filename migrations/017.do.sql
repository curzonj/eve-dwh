DROP INDEX station_order_stats_i1;
alter table station_order_stats add CONSTRAINT station_order_stats_pkey2 primary key (type_id, region_id, station_id);
