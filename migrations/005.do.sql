CREATE TABLE wallet_transactions (
    transaction_id bigint PRIMARY KEY,
    character_id bigint references managed_characters (character_id) not null,
    occured_at timestamptz not null,
    quantity bigint not null,
    type_id integer references "invTypes" ("typeID") not null,
    price NUMERIC(16, 2) not null,
    client_id integer not null,
    station_id integer references "staStations" ("stationID") not null,
    buy boolean not null,
    corporate_order boolean not null,
    journal_ref_id bigint not null
);

CREATE TABLE wallet_journal (
    journal_ref_id bigint PRIMARY KEY,
    character_id bigint references managed_characters (character_id) not null,
    occured_at timestamptz not null,
    ref_type_id integer not null,
    -- Use https://eveonline-third-party-documentation.readthedocs.org/en/latest/xmlapi/eve_characterinfo/ to determine if it's a character or corp
    party_1_id integer not null,
    party_2_id integer not null,
    amount NUMERIC(18, 2) not null,
    reason varchar(255),
    tax_collector_id integer,
    tax_amount NUMERIC(16, 2),
    optional_id bigint,
    optional_value varchar(255)
);

CREATE TABLE assets (
    station_id integer references "staStations" ("stationID") not null,
    type_id integer references "invTypes" ("typeID") not null,
    quantity bigint not null,
    updated_at timestamptz not null,

    PRIMARY KEY(type_id, station_id)
);

create view purchase_costs as
select a2.*, 
  COALESCE(
      (select s1.avg_price from
        (select t1.type_id, t1.station_id, t1.occured_at,
                (select sum(quantity) from wallet_transactions t2 where t1.type_id = t2.type_id and buy = true and t2.occured_at >= t1.occured_at) as quantity_sum,
                (select sum(quantity * price)/sum(quantity) from wallet_transactions t2 where t1.type_id = t2.type_id and buy = true and t2.occured_at >= t1.occured_at) as avg_price
            from wallet_transactions t1 where buy = true order by occured_at desc) s1
              where a2.station_id = s1.station_id and a2.type_id = s1.type_id and s1.quantity_sum > a2.quantity),
      (select max(m1.price) from market_orders m1 where m1.type_id = a2.type_id and m1.station_id = a2.station_id and disappeared_at is null and buy = true)) as cost

  from (
      select a1.station_id, a1.type_id, (a1.quantity +
        COALESCE((select sum(wt.quantity) from wallet_transactions wt where wt.occured_at > a1.updated_at and wt.buy = true and wt.type_id = a1.type_id and wt.station_id = a1.station_id), 0) -
        coalesce((select sum(wt.quantity) from wallet_transactions wt where wt.occured_at > a1.updated_at and wt.buy = false and wt.type_id = a1.type_id and wt.station_id = a1.station_id), 0)
      ) as quantity
      from assets a1
  ) a2;

