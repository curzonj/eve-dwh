'use strict';

var express = require('express');
var router = express.Router();

// Put this behind authentication
router.get('/', function(req, res) {
  if (req.is_igb) {
    res.render('orders.igb', { layout: 'igb' })
  } else {
    res.render('orders')
  }
})

module.exports = router
