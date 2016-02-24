'use strict';

var debugLib = require("debug")
var logfmt = require('logfmt')

debugLib.formatArgs = function() {
    var args = arguments;
    args[0] = this.namespace + ' ' + args[0]
    return args
}
function debug(scope, obj) {
    var str = obj
    if (typeof obj !== "string")
        str = logfmt.stringify(obj)

    debugLib(scope)(str)
}

module.exports = debug
