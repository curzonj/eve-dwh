'use strict';

var debug = require('./debug')

var database_url = process.env.DATABASE_URL;
if (database_url === undefined) {
    console.error("Missing DATABASE_URL")
    process.exit(1)
}

if (database_url.indexOf("amazonaws.com") > -1)
    database_url = database_url + "?ssl=true"

var sql = require('knex')({
    client: 'pg',
    connection: database_url,
    pool: {
        min: 1,
        max: 20
    }
});

sql.DATABASE_URL = database_url

sql.on('query', (data) => {
    debug('sql', { query: data.sql, bindings: data.bindings })
})

module.exports = sql
