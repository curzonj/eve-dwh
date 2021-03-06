alter table market_daily_stats
  drop column day_buy_order_price_changes,
  drop column day_sell_order_price_changes,
  drop column day_buy_price_min_tx,
  drop column day_sell_price_min_tx,
  drop column day_buy_price_max_tx,
  drop column day_sell_price_max_tx,
  drop column day_buy_price_wavg_tx,
  drop column day_sell_price_wavg_tx,
  drop column day_new_buy_orders,
  drop column day_new_sell_orders,
  drop column day_buy_orders_tx,
  drop column day_sell_orders_tx,
  drop column day_buy_units_tx,
  drop column day_sell_units_tx;
