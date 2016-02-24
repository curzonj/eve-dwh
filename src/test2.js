
'use strict';

var lib = require('./library')
var neow = require('neow')
var Promise = require('bluebird')
var _ = require('lodash')
var neowCache = require('neow/lib/caching/disk')
var neowDiskCache = new neowCache.DiskCache()
// corporate
//var client = new neow.EveClient({ keyID: process.env.CORPORATE_KEYID, vCode: process.env.CORPORATE_VCODE }, null, neowDiskCache)

// character
var client = new neow.EveClient({ keyID: process.env.CORPORATE_KEYID, vCode: process.env.CHAR_VCODE }, null, neowDiskCache)

var AIFs = [ 2470, 2472, 2474, 2480, 2484, 2485, 2491, 2494 ]
var launchPads = [ 2256, 2542, 2543, 2544, 2552, 2555, 2556, 2557 ]
var storages = launchPads + [ 2257, 2535, 2536, 2541, 2558, 2560, 2561, 2562 ]

Promise.try(function() {
    //return client.fetch('corp:AssetList', { corporationID: 98189435 })
    //return client.fetch('char:PlanetaryColonies', { characterID: 92453716 })

    return rawEveResponse(function() {
        return client.fetch('char:PlanetaryPins', { characterID: 92453716, planetID: 40009950 })
    }).then(function(pins) {
        return client.fetch('char:PlanetaryRoutes', { characterID: 92453716, planetID: 40009950 }).then(function(routes) {
            return [ pins, routes ]
        })
    })
}).spread(function(pins, routes){
    // map to pin ids
    // fetch the routes
    // group AIFs by source
    var rebuilt = _.reduce(pins.pins, function(hash, pin) {
        var pinData

        if (!_.has(hash, pin.pinID)) {
            pinData = hash[pin.pinID] = {
                pinID: parseInt(pin.pinID),
                typeID: parseInt(pin.typeID),
                schematicID: parseInt(pin.schematicID),
                lastLaunchTime: new Date(pin.lastLaunchTime),
                contents: {},
                sources: {},
                sinks: {}
            }
        } else {
            pinData = hash[pin.pinID]
        }

        pinData.contents[pin.contentTypeID] = parseInt(pin.contentQuantity)

        return hash
    })

    _.forEach(routes.routes, function(v) {
        var type_id = parseInt(v.contentTypeID);
        (rebuilt[v.sourcePinID].sinks[type_id]        = rebuilt[v.sourcePinID].sinks[type_id]        || []).push(v.destinationPinID);
        (rebuilt[v.destinationPinID].sources[type_id] = rebuilt[v.destinationPinID].sources[type_id] || []).push(v.sourcePinID);
    })

    return rebuilt
}).tap(function(result){
    return Promise.each(_.values(result), function(value) {
        if (value.schematicID > 0)
            return lib.sql("planetSchematicsTypeMap").where({ schematicID: value.schematicID  }).then(function(rows) {
                value.schematics = rows
            })
    })
}).then(function(result){
   var storagePins = _.filter(_.values(result), function(o, i) {
        return _.includes(storages, o.typeID)
   })

   _.each(storagePins, function(pin) {
       pin.ttls = {}
       _.each(pin.sinks, function(other_id_list, type_id) {
           console.log(pin.sinks)
           var rate_p_hour = 0
           var contents = pin.contents[type_id] || 0
           var earliest = new Date()

           _.each(other_id_list, function(other_pin_id) {
               console.log(other_id_list, other_pin_id)
               var other_pin = result[other_pin_id]
               var schem = _.find(other_pin.schematics, function(o) {
                   return o.isInput && o.typeID == type_id
               })

               rate_p_hour = rate_p_hour + schem.quantity
               earliest = Math.min(other_pin.lastLaunchTime, earliest)
           })

           var done_at = new Date(earliest + ((contents / rate_p_hour) * 3600 * 1000))
           pin.ttls[type_id] = {
               rate_p_hour: rate_p_hour,
               earliest: new Date(earliest),
               done_at: done_at,
               ttl_hrs: (done_at - new Date()) / (3600* 1000)
           }
       })
   })

   return storagePins
}).then(function(result){
    console.log(JSON.stringify(result, null, 2))
}).then(function() {
    process.exit()
})

var parseString = Promise.promisify(require('neow/node_modules/xml2js').parseString);

function rawEveResponse(fn) {
    var oldParser = client.parser
    client.parser = { parse: function(data) {
        return parseString(data).then(function(result) {
            var retVal = {
                currentTime: _.head(result.eveapi.currentTime),
                cachedUntil: _.head(result.eveapi.cachedUntil)
            }

            _.forEach(_.head(result.eveapi.result).rowset, function(rowset) {
                retVal[rowset["$"].name] = _.map(rowset.row, function(row) {
                    return row["$"]
                })
            })

            return retVal
        })
    } }

    return fn().tap(function() {
        client.parser = oldParser;
    })
}
