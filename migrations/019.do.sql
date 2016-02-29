drop view purchase_costs;

create view purchase_costs as
select a2.*,
  COALESCE(
      (select s1.avg_price from
        (select t1.type_id, t1.station_id, t1.occured_at,
                (select sum(quantity) from wallet_transactions t2 where t1.type_id = t2.type_id and buy = true and t2.occured_at >= t1.occured_at) as quantity_sum,
                (select sum(quantity * price * 1.0075)/sum(quantity) from wallet_transactions t2 where t1.type_id = t2.type_id and buy = true and t2.occured_at >= t1.occured_at) as avg_price
            from wallet_transactions t1 where buy = true order by occured_at desc) s1
              where a2.station_id = s1.station_id and a2.type_id = s1.type_id and s1.quantity_sum >= a2.quantity limit 1),
      (select max(m1.price) * 1.0075 from market_orders m1 where m1.type_id = a2.type_id and m1.station_id = a2.station_id and buy = true)) as cost
  from (
      select a1.station_id, a1.type_id, (a1.quantity +
        COALESCE((select sum(volume_remaining) from character_order_details co join market_orders mo using (id) where buy = false and co.type_id = a1.type_id and co.station_id = a1.station_id), 0) +
        COALESCE((select sum(wt.quantity) from wallet_transactions wt where wt.occured_at > a1.updated_at and wt.buy = true and wt.type_id = a1.type_id and wt.station_id = a1.station_id), 0) -
        coalesce((select sum(wt.quantity) from wallet_transactions wt where wt.occured_at > a1.updated_at and wt.buy = false and wt.type_id = a1.type_id and wt.station_id = a1.station_id), 0)
      ) as quantity
      from assets a1 UNION
      select co.station_id, co.type_id, volume_remaining quantity from character_order_details co join market_orders mo using (id) where buy = false and not exists (select 1 from assets a3 where a3.type_id = co.type_id and a3.station_id = co.station_id and quantity > 0)
  ) a2;
