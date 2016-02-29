'use strict';

const debug = require('./debug')
const _ = require('lodash')

var database_url = process.env.DATABASE_URL;
if (database_url === undefined) {
    console.error("Missing DATABASE_URL")
    process.exit(1)
}

if (database_url.indexOf("amazonaws.com") > -1)
    database_url = database_url + "?ssl=true"

const sql = require('knex')({
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

sql.utils = {
    parseNumbers: function(result) {
        function parseOne(o) {
            _.forEach(o, function(v, k, o) {
                if (typeof v === 'string') {
                    v = parseFloat(v)
                    if (!isNaN(v))
                        o[k] = v
                }
            })
        }

        if (_.isArray(result)) {
            _.forEach(result, parseOne)
        } else {
            parseOne(result)
        }

        return result
    }
}

module.exports = sql
