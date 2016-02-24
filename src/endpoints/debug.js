'use strict';

const express = require('express');
const router = express.Router();
const lib = require('../library')
const stats = require('../metrics').stats
const sql = require('../sql')

router.get('/metrics', function(req, res) {
    sql("metric_observations").whereRaw("updated_at > now() - interval '180 seconds'").
    then(function(results) {
        res.type("application/json")
        res.send(JSON.stringify(results, null, 2))
    })
})

module.exports = router
