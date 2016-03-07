'use strict';

module.exports = function(app) {
  app.use('/api', require('./endpoints/api'))
  app.use('/_', require('./endpoints/debug'))
  app.use('/', require('./endpoints/ui'))
}
