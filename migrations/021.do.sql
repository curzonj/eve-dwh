alter table wallet_transactions
  drop constraint wallet_transactions_station_id_fkey,
  drop constraint wallet_transactions_type_id_fkey;

alter table assets
  drop constraint assets_station_id_fkey,
  drop constraint assets_type_id_fkey;

alter table trade_regions
  drop constraint trade_regions_region_id_fkey;

alter table historical_orders
  drop constraint historical_orders_region_id_fkey,
  drop constraint historical_orders_type_id_fkey;

alter table station_order_stats
  drop constraint station_order_stats_region_id_fkey,
  drop constraint station_order_stats_station_id_fkey,
  drop constraint station_order_stats_type_id_fkey;

alter table station_order_stats_ts
  drop constraint station_order_stats_ts_region_id_fkey,
  drop constraint station_order_stats_ts_station_id_fkey,
  drop constraint station_order_stats_ts_type_id_fkey;
