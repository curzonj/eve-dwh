alter table station_order_stats
        drop column buy_orders,
        drop column sell_orders;

alter table station_order_stats_ts
        drop column buy_orders,
        drop column sell_orders;
