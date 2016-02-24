CREATE TABLE eve_api_keys (
        key_id integer PRIMARY KEY,
        vcode char(64),
        is_corporate boolean not null default false
);

CREATE TABLE corporations (
        corporation_id integer PRIMARY KEY,
        name varchar(255) not null
);

CREATE TABLE managed_corps (
        corporation_id integer references corporations (corporation_id),
        key_id integer references eve_api_keys (key_id) not null,

        PRIMARY KEY(corporation_id)
);

CREATE TABLE characters (
        character_id bigint PRIMARY KEY,
        corporation_id integer references corporations (corporation_id),
        name varchar(255) not null
);

CREATE TABLE managed_characters (
        character_id bigint references characters (character_id) not null,
        key_id integer references eve_api_keys (key_id) not null,

        total_orders integer not null default 5,
        broker_fee_rate numeric(8, 8) not null default 0.01,
        sales_tax_rate numeric(8, 8) not null default 0.025,
        poco_tax_rate numeric(2, 2) not null default 0.15,

        PRIMARY KEY (character_id)
);

-- https://api.eveonline.com/eve/SkillTree.xml.aspx
CREATE TABLE character_skills (
        character_id bigint references managed_characters (character_id) not null,
        type_id integer not null,
        skill_level integer not null,

        PRIMARY KEY(character_id, type_id)
);

CREATE TABLE standings (
        character_id bigint references managed_characters (character_id) not null,
        corporation_id integer references corporations (corporation_id) not null,

        standing numeric(4, 2) not null default 0.0,
        broker_fee_rate numeric(8, 8) not null default 0.01,

        PRIMARY KEY(character_id, corporation_id)
);
