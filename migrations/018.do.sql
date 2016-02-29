alter table station_order_stats
        add column buy_orders integer,
        add column sell_orders integer;

alter table station_order_stats_ts
        alter column buy_units_vol_chg type bigint,
        alter column buy_units_disappeared type bigint,
        alter column sell_units_vol_chg type bigint,
        alter column sell_units_disappeared type bigint,
        add column buy_orders integer,
        add column sell_orders integer;
