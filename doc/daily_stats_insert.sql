insert into :table_name: (
  date_of,
  type_id,
  station_id,
  region_id,

  stats_timestamp,
  buy_price_max,
  buy_price_wavg,
  buy_price_5pct,
  buy_price_median,
  buy_units,
  buy_orders_price_chg,
  buy_orders_vol_chg,
  buy_orders_disappeared,
  buy_units_vol_chg,
  buy_units_disappeared,
  buy_price_wavg_sold,
  buy_price_min_sold,
  buy_price_max_sold,
  sell_price_min,
  sell_price_wavg,
  sell_price_5pct,
  sell_price_median,
  sell_units,
  sell_orders_price_chg,
  sell_orders_vol_chg,
  sell_orders_disappeared,
  sell_units_vol_chg,
  sell_units_disappeared,
  sell_price_wavg_sold,
  sell_price_min_sold,
  sell_price_max_sold,
  new_sell_orders,
  new_buy_orders,
  new_sell_order_units,
  new_buy_order_units,

  day_buy_order_price_changes,
  day_sell_order_price_changes,
  day_buy_price_min_tx,
  day_sell_price_min_tx,
  day_buy_price_max_tx,
  day_sell_price_max_tx,
  day_buy_price_wavg_tx,
  day_sell_price_wavg_tx,
  day_new_buy_orders,
  day_new_sell_orders,
  day_buy_orders_tx,
  day_sell_orders_tx,
  day_buy_units_tx,
  day_sell_units_tx,
  day_avg_buy_units,
  day_avg_sell_units
) values (
  :date_of,
  :type_id,
  :station_id,
  :region_id,

  ARRAY[ ( :stats_timestamp )::integer ],
  ARRAY[ ( :buy_price_max )::numeric(16,2) ],
  ARRAY[ ( :buy_price_wavg )::numeric(16,2) ],
  ARRAY[ ( :buy_price_5pct )::numeric(16,2) ],
  ARRAY[ ( :buy_price_median )::numeric(16,2) ],
  ARRAY[ ( :buy_units )::bigint ],
  ARRAY[ ( :buy_orders_price_chg )::integer ],
  ARRAY[ ( :buy_orders_vol_chg )::integer ],
  ARRAY[ ( :buy_orders_disappeared )::integer ],
  ARRAY[ ( :buy_units_vol_chg )::bigint ],
  ARRAY[ ( :buy_units_disappeared )::bigint ],
  ARRAY[ ( :buy_price_wavg_sold )::numeric(16,2) ],
  ARRAY[ ( :buy_price_min_sold )::numeric(16,2) ],
  ARRAY[ ( :buy_price_max_sold )::numeric(16,2) ],
  ARRAY[ ( :sell_price_min )::numeric(16,2) ],
  ARRAY[ ( :sell_price_wavg )::numeric(16,2) ],
  ARRAY[ ( :sell_price_5pct )::numeric(16,2) ],
  ARRAY[ ( :sell_price_median )::numeric(16,2) ],
  ARRAY[ ( :sell_units )::bigint ],
  ARRAY[ ( :sell_orders_price_chg )::integer ],
  ARRAY[ ( :sell_orders_vol_chg )::integer ],
  ARRAY[ ( :sell_orders_disappeared )::integer ],
  ARRAY[ ( :sell_units_vol_chg )::bigint ],
  ARRAY[ ( :sell_units_disappeared )::bigint ],
  ARRAY[ ( :sell_price_wavg_sold )::numeric(16,2) ],
  ARRAY[ ( :sell_price_min_sold )::numeric(16,2) ],
  ARRAY[ ( :sell_price_max_sold )::numeric(16,2) ],
  ARRAY[ ( :new_sell_orders )::integer ],
  ARRAY[ ( :new_buy_orders )::integer ],
  ARRAY[ ( :new_sell_order_units )::bigint ],
  ARRAY[ ( :new_buy_order_units )::bigint ],

  :buy_orders_price_chg,
  :sell_orders_price_chg,
  :buy_price_min_sold,
  :sell_price_min_sold,
  :buy_price_max_sold,
  :sell_price_max_sold,
  :buy_price_wavg_sold,
  :sell_price_wavg_sold,
  :new_buy_orders,
  :new_sell_orders,
  ( ( :buy_orders_vol_chg )::integer + ( :buy_orders_disappeared )::integer ),
  ( ( :sell_orders_vol_chg )::integer + ( :sell_orders_disappeared )::integer ),
  ( ( :buy_units_vol_chg )::bigint + ( :buy_units_disappeared )::bigint ),
  ( ( :sell_units_vol_chg )::bigint + ( :sell_units_disappeared )::bigint ),
  ( :buy_units )::bigint,
  ( :sell_units )::bigint
) on conflict (type_id, region_id, station_id, date_of) do update set
  stats_timestamp = array_append( :table_name:.stats_timestamp,  ( :stats_timestamp )::integer),
  buy_price_max = array_append( :table_name:.buy_price_max,  ( :buy_price_max )::numeric(16,2)),
  buy_price_wavg = array_append( :table_name:.buy_price_wavg,  ( :buy_price_wavg )::numeric(16,2)),
  buy_price_5pct = array_append( :table_name:.buy_price_5pct,  ( :buy_price_5pct )::numeric(16,2)),
  buy_price_median = array_append( :table_name:.buy_price_median,  ( :buy_price_median )::numeric(16,2)),
  buy_units = array_append( :table_name:.buy_units,  ( :buy_units )::bigint),
  buy_orders_price_chg = array_append( :table_name:.buy_orders_price_chg,  ( :buy_orders_price_chg )::integer),
  buy_orders_vol_chg = array_append( :table_name:.buy_orders_vol_chg,  ( :buy_orders_vol_chg )::integer),
  buy_orders_disappeared = array_append( :table_name:.buy_orders_disappeared,  ( :buy_orders_disappeared )::integer),
  buy_units_vol_chg = array_append( :table_name:.buy_units_vol_chg,  ( :buy_units_vol_chg )::bigint),
  buy_units_disappeared = array_append( :table_name:.buy_units_disappeared,  ( :buy_units_disappeared )::bigint),
  buy_price_wavg_sold = array_append( :table_name:.buy_price_wavg_sold,  ( :buy_price_wavg_sold )::numeric(16,2)),
  buy_price_min_sold = array_append( :table_name:.buy_price_min_sold,  ( :buy_price_min_sold )::numeric(16,2)),
  buy_price_max_sold = array_append( :table_name:.buy_price_max_sold,  ( :buy_price_max_sold )::numeric(16,2)),
  sell_price_min = array_append( :table_name:.sell_price_min,  ( :sell_price_min )::numeric(16,2)),
  sell_price_wavg = array_append( :table_name:.sell_price_wavg,  ( :sell_price_wavg )::numeric(16,2)),
  sell_price_5pct = array_append( :table_name:.sell_price_5pct,  ( :sell_price_5pct )::numeric(16,2)),
  sell_price_median = array_append( :table_name:.sell_price_median,  ( :sell_price_median )::numeric(16,2)),
  sell_units = array_append( :table_name:.sell_units,  ( :sell_units )::bigint),
  sell_orders_price_chg = array_append( :table_name:.sell_orders_price_chg,  ( :sell_orders_price_chg )::integer),
  sell_orders_vol_chg = array_append( :table_name:.sell_orders_vol_chg,  ( :sell_orders_vol_chg )::integer),
  sell_orders_disappeared = array_append( :table_name:.sell_orders_disappeared,  ( :sell_orders_disappeared )::integer),
  sell_units_vol_chg = array_append( :table_name:.sell_units_vol_chg,  ( :sell_units_vol_chg )::bigint),
  sell_units_disappeared = array_append( :table_name:.sell_units_disappeared,  ( :sell_units_disappeared )::bigint),
  sell_price_wavg_sold = array_append( :table_name:.sell_price_wavg_sold,  ( :sell_price_wavg_sold )::numeric(16,2)),
  sell_price_min_sold = array_append( :table_name:.sell_price_min_sold,  ( :sell_price_min_sold )::numeric(16,2)),
  sell_price_max_sold = array_append( :table_name:.sell_price_max_sold,  ( :sell_price_max_sold )::numeric(16,2)),
  new_sell_orders = array_append( :table_name:.new_sell_orders,  ( :new_sell_orders )::integer),
  new_buy_orders = array_append( :table_name:.new_buy_orders,  ( :new_buy_orders )::integer),
  new_sell_order_units = array_append( :table_name:.new_sell_order_units,  ( :new_sell_order_units )::bigint),
  new_buy_order_units = array_append( :table_name:.new_buy_order_units,  ( :new_buy_order_units )::bigint),

  day_buy_order_price_changes = :table_name:.day_buy_order_price_changes + EXCLUDED.day_buy_order_price_changes,
  day_sell_order_price_changes = :table_name:.day_sell_order_price_changes + EXCLUDED.day_sell_order_price_changes,
  day_buy_price_min_tx = LEAST( :table_name:.day_buy_price_min_tx, EXCLUDED.day_buy_price_min_tx),
  day_sell_price_min_tx = LEAST( :table_name:.day_sell_price_min_tx, EXCLUDED.day_sell_price_min_tx),
  day_buy_price_max_tx = GREATEST( :table_name:.day_buy_price_max_tx, EXCLUDED.day_buy_price_max_tx),
  day_sell_price_max_tx = GREATEST( :table_name:.day_sell_price_max_tx, EXCLUDED.day_sell_price_max_tx),

  day_buy_price_wavg_tx =
    CASE
      WHEN EXCLUDED.day_buy_units_tx = 0 then
        :table_name:.day_buy_price_wavg_tx
      WHEN :table_name:.day_buy_price_wavg_tx IS NULL then
        EXCLUDED.day_buy_price_wavg_tx
      WHEN :table_name:.day_buy_price_wavg_tx IS NOT NULL then
        (
          ( :table_name:.day_buy_price_wavg_tx * :table_name:.day_buy_units_tx) +
          (EXCLUDED.day_buy_price_wavg_tx * EXCLUDED.day_buy_units_tx)
        ) / ( :table_name:.day_buy_units_tx + EXCLUDED.day_buy_units_tx)
    END,

  day_sell_price_wavg_tx =
    CASE
      WHEN EXCLUDED.day_sell_units_tx = 0 then
        :table_name:.day_sell_price_wavg_tx
      WHEN :table_name:.day_sell_price_wavg_tx IS NULL then
        EXCLUDED.day_sell_price_wavg_tx
      WHEN :table_name:.day_sell_price_wavg_tx IS NOT NULL then
        (
          ( :table_name:.day_sell_price_wavg_tx * :table_name:.day_sell_units_tx) +
          (EXCLUDED.day_sell_price_wavg_tx * EXCLUDED.day_sell_units_tx)
        ) / ( :table_name:.day_sell_units_tx + EXCLUDED.day_sell_units_tx)
    END,

  day_new_buy_orders = :table_name:.day_new_buy_orders + EXCLUDED.day_new_buy_orders,
  day_new_sell_orders = :table_name:.day_new_sell_orders + EXCLUDED.day_new_sell_orders,
  day_buy_orders_tx = :table_name:.day_buy_orders_tx + EXCLUDED.day_buy_orders_tx,
  day_sell_orders_tx = :table_name:.day_sell_orders_tx + EXCLUDED.day_sell_orders_tx,
  day_buy_units_tx = :table_name:.day_buy_units_tx + EXCLUDED.day_buy_units_tx,
  day_sell_units_tx = :table_name:.day_sell_units_tx + EXCLUDED.day_sell_units_tx,
  day_avg_buy_units = (select AVG(unnest) from unnest(array_append( :table_name:.buy_units,  ( :buy_units )::bigint))),
  day_avg_sell_units = (select AVG(unnest) from unnest(array_append( :table_name:.sell_units,  ( :sell_units )::bigint)))
;
