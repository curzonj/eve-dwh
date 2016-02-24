drop table historical_orders;
drop table character_order_details;
drop table trade_regions;

alter table market_orders add column disappeared_at timestamptz;
alter table market_polling drop column orders_polling_override;
