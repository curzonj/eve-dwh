create table neow_cache (
        sha1_hex char(41) primary key,
        cache_until timestamptz not null,
        json_data jsonb not null
);
