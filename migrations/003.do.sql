create index market_history_reverse_index on market_history (region_id, type_id);
create index history_polling_interval_index on market_polling (history_polling_interval);

CREATE MATERIALIZED VIEW order_frequencies AS select type_id, region_id, trunc(trunc(max(history_date) - min(history_date) + 1, 2) / count(*), 4) as ratio, trunc(avg(quantity), 4) as avg_quantity, trunc(avg(orders), 4) as avg_orders from market_history group by region_id, type_id;
create index pkey on order_frequencies (region_id, type_id);
