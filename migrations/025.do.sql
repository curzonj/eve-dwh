alter table station_order_stats_ts
  add column buy_order_data jsonb,
  add column sell_order_data jsonb,
  add column new_buy_order_units bigint,
  add column new_sell_order_units bigint;
