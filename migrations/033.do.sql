alter table market_daily_stats
  add column day_avg_buy_units bigint not null default 0,
  add column day_avg_sell_units bigint not null default 0;

update market_daily_stats s2 set
  day_avg_buy_units = (select avg(unnest) from unnest(sell_units)),
  day_avg_sell_units = (select avg(unnest) from unnest(sell_units));
