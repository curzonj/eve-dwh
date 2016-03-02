'use strict';

var express = require('express');
var router = express.Router();

// Put this behind authentication
router.get('/', function(req, res) {
    res.redirect("/test.html")
})

module.exports = router
