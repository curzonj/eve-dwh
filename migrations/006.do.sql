CREATE TABLE trade_regions (
    character_id bigint references managed_characters (character_id) not null,
    region_id integer references "mapRegions" ("regionID") not null,
    
    PRIMARY KEY(character_id, region_id)
);

CREATE TABLE character_order_details (
    id bigint PRIMARY KEY,
    character_id bigint references managed_characters (character_id) not null,
    order_state integer not null,
    account_key integer not null,
    escrow NUMERIC(16, 2) not null,
    type_id integer references "invTypes" ("typeID") not null,
    region_id integer references "mapRegions" ("regionID") not null,
    station_id integer references "staStations" ("stationID") not null
);

drop view purchase_costs;

alter table market_orders rename column disappeared_at to prev_disappeared_at;
alter table market_orders add column disappeared_at timestamptz;

update market_orders set disappeared_at = prev_disappeared_at;
alter table market_orders drop column prev_disappeared_at;

CREATE TABLE historical_orders (
    id bigint not null,
    first_observed_at timestamptz not null,
    observed_at timestamptz not null,
    price NUMERIC(16, 2) not null,
    volume_remaining bigint not null,
    volume_entered bigint not null,
    min_volume integer not null,
    buy boolean not null,
    issue_date timestamptz not null,
    duration integer not null,
    range integer not null,
    type_id integer references "invTypes" ("typeID") not null,
    station_id integer not null,
    region_id integer references "mapRegions" ("regionID") not null,

    disappeared_at timestamptz not null default (now() at time zone 'utc'),
    PRIMARY KEY(id, first_observed_at)
);

WITH moved_rows AS (
    DELETE FROM market_orders WHERE disappeared_at is not null RETURNING *
) INSERT INTO historical_orders SELECT * FROM moved_rows;

alter table market_orders drop column disappeared_at;
alter table market_polling add column orders_polling_override interval DAY TO MINUTE;

create view purchase_costs as
select a2.*, 
  COALESCE(
      (select s1.avg_price from
        (select t1.type_id, t1.station_id, t1.occured_at,
                (select sum(quantity) from wallet_transactions t2 where t1.type_id = t2.type_id and buy = true and t2.occured_at >= t1.occured_at) as quantity_sum,
                (select sum(quantity * price)/sum(quantity) from wallet_transactions t2 where t1.type_id = t2.type_id and buy = true and t2.occured_at >= t1.occured_at) as avg_price
            from wallet_transactions t1 where buy = true order by occured_at desc) s1
              where a2.station_id = s1.station_id and a2.type_id = s1.type_id and s1.quantity_sum > a2.quantity),
      (select max(m1.price) from market_orders m1 where m1.type_id = a2.type_id and m1.station_id = a2.station_id and buy = true)) as cost

  from (
      select a1.station_id, a1.type_id, (a1.quantity +
        COALESCE((select sum(wt.quantity) from wallet_transactions wt where wt.occured_at > a1.updated_at and wt.buy = true and wt.type_id = a1.type_id and wt.station_id = a1.station_id), 0) -
        coalesce((select sum(wt.quantity) from wallet_transactions wt where wt.occured_at > a1.updated_at and wt.buy = false and wt.type_id = a1.type_id and wt.station_id = a1.station_id), 0)
      ) as quantity
      from assets a1
  ) a2;
