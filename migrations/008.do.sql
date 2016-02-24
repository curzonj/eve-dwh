create index market_order_changes_i2 on market_order_changes (type_id, region_id, observed_at, disappeared);
create index market_order_changes_i3 on market_order_changes (observed_at, disappeared);
create index market_polling_i2 on market_polling (orders_next_polling_at);
create index market_polling_i3 on market_polling (history_next_polling_at);
