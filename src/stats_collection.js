'use strict';

// Used to get around circular dependencies, only `sql`
// should directly require this if needed
module.exports = require('measured').createCollection()
