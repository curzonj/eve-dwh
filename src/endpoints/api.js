'use strict';

var express = require('express');
var router = express.Router();
var lib = require('../library')

router.post('/sql', function(req, res) {
    var query

    switch(req.query.query) {
        case "types":
            query = lib.sql("invTypes").limit(10)
            break
        default:
            res.status(404).json({ errorDetails: "No such query" })
            return
    }

    query.then(function(result) {
        res.json(result)
    })
})

module.exports = router
