# Operations

## Upgrading SDE

```bash
app_name=eve-crest-dwh

heroku_db_url=$(heroku config:get DATABASE_URL)
heroku ps:scale web=0 crest=0 clock=0 eve_api=0

psql "$heroku_db_url" -f doc/drop_views.sql

cd dumps
mv postgres-latest.dmp.v{N}
wget https://www.fuzzwork.co.uk/dump/postgres-latest.dmp.bz2
bunzip2 postgres-latest.dmp.bz2

db_url_parts=$(ruby -ruri -e "URI.parse('$heroku_db_url').tap {|u| puts \"#{u.host}:#{u.port}:#{u.user}:#{u.password}:#{u.path.tr('/','')}\" }")
db_host=$(echo $db_url_parts | awk -F: '{print $1}')
db_port=$(echo $db_url_parts | awk -F: '{print $2}')
db_user=$(echo $db_url_parts | awk -F: '{print $3}')
db_password=$(echo $db_url_parts | awk -F: '{print $4}')
db_name=$(echo $db_url_parts | awk -F: '{print $5}')

PGPASSWORD=$db_password pg_restore --verbose --clean --no-acl --no-owner -h $db_host -U $db_user -d $db_name -p $db_port postgres-latest.dmp

cd ../

psql "$heroku_db_url" -f doc/rebuild_views.sql
psql "$heroku_db_url" -f doc/configure_new_types.sql

heroku ps:scale web=1 crest=3 clock=1 eve_api=1
```

Wait for all the history AND orders to get polled and then run `update_polling.sql`
to add items to the `order_frequencies` and `observed_history` views and to
recalibrate the polling intervals.

```
heroku pg:psql < doc/update_polling.sql
```
