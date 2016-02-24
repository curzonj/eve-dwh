#!/usr/bin/env node

'use strict';

const bluebird = require("bluebird")
const http = require("http")
const express = require("express")
const logfmt = require('logfmt')
const swaggerTools = require('swagger-tools')
const urlUtil = require("url")
const lib = require('../src/library')
const uuidGen = require('node-uuid')
const passport = require('passport')
const helmet = require('helmet')
const EveOnlineStrategy = require('passport-eveonline')
const cookieParser = require('cookie-parser')
const session = require('express-session')
const sql = require('../src/sql')
const KnexSessionStore = new (require('connect-session-knex')(session))({ knex: sql })
const debug = require('../src/debug')
const express_enforces_ssl = require('express-enforces-ssl');
const passportSocketIo = require("passport.socketio")

lib.setupSignalHandlers()
 
const app = express()
const canonical_url = urlUtil.parse(process.env.CANONICAL_URL)
const useSSL = (canonical_url.protocol === 'https:')

if (useSSL) {
    debug('http', "Enabling SSL Enforcement")
    app.enable('trust proxy')
    app.use(express_enforces_ssl())

    const ninetyDaysInMilliseconds = 7776000000;
    app.use(helmet.hsts({ maxAge: ninetyDaysInMilliseconds }))
}

app.use(function(req, res, next) {
    var timer = logfmt.time()

    req.id = req.headers['x-request-id'] || uuidGen.v1()

    logfmt.log({
        request_id: req.id,
        at: "start",
        referer: req.get('Referer'),
        method: req.method,
        url: req.originalUrl
    })

    res.on('finish', function() {
        timer.log({
            request_id: req.id,
            at: "finished",
            status: res.statusCode,
            method: req.method,
            url: req.originalUrl
        })
    })

    next()
})

app.use(cookieParser(process.env.COOKIE_SECRET))
app.use(session({
    secret: process.env.COOKIE_SECRET,
    cookie: { secure: useSSL },
    store: KnexSessionStore,
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())

passport.use(new EveOnlineStrategy({
    clientID: process.env.EVE_OAUTH_CLIENT_ID,
    clientSecret: process.env.EVE_OAUTH_SECRET_KEY,
    callbackURL: process.env.CANONICAL_URL+process.env.EVE_OAUTH_CALLBACK
  },
  function(characterInformation, done) {
      debug("eve:auth", characterInformation)

      if (characterInformation.CharacterID === 92453716) {
          done(null, { CharacterID: characterInformation.CharacterID })
      } else {
          done(null, false, { message: "Restricted Area" })
      }
  }
))

passport.serializeUser(function(user, done) {
    done(null, user.CharacterID)
});

passport.deserializeUser(function(id, done) {
    done(null, { CharacterID: id })
})

app.get('/auth/eveonline/callback',
  passport.authenticate('eveonline', {
      successRedirect: '/',
      failureRedirect: 'https//secure.eveonline.com'
    })
)

var eve_online_authenticate_middleware = passport.authenticate('eveonline')
app.use(function(req, resp, next) {
    if (req.user === undefined) {
        return eve_online_authenticate_middleware(req, resp, next)
    } else {
        next()
    }
})

app.use(express.static('public'))

var swaggerDoc = require('../doc/swagger.json');
swaggerDoc.host = canonical_url.host

swaggerTools.initializeMiddleware(swaggerDoc, function (middleware) {
    // Interpret Swagger resources and attach metadata to request - must be first in swagger-tools middleware chain
    app.use(middleware.swaggerMetadata());

    // Serve the Swagger documents and Swagger UI unauthenticated
    app.use(middleware.swaggerUi());

    // Provide the security handlers
    app.use(middleware.swaggerSecurity({
        "swagger-ui-key": function (req, def, api_key, callback) {
            // Here we could enforce the swagger authentication if we weren't using passport
            callback()
        }
    }));

    app.use(function(req, res, next) {
        //console.log(req.swagger)

        // We ignore the specifics atm about what security
        // is required. We also authenticate anything not
        // specified by swagger. Secure by default.
        if (req.swagger && req.swagger.security && req.swagger.security.length === 0) {
            // Skip authentication if swagger explicitly defines it as unsecured
            return next()
        } else {
            // Here we would enforce the swagger authentication if we weren't using passport
            next()
        }
    })

    // Validate Swagger requests
    app.use(middleware.swaggerValidator({
        validateResponse: true
    }));

    app.use(function(req, res, next) {
        if (req.body !== undefined)
            logfmt.log({ request_id: req.id, request_body: JSON.stringify(req.body) })

        var originalEnd = res.end
        res.end = function(data, encoding) {
            res.end = originalEnd

            var val = data
            if (val instanceof Buffer) {
                val = data.toString(encoding);
            }

            debug('http:response', { request_id: req.id, response_body: val.replace(/\n/g, " ") })

            res.end(data, encoding)
        }

        next()
    })

    require('../src/endpoints')(app)

    // This only handles synchronous errors. bluebird errors
    // still need a promise based error handler
    app.use(function(err, req, res, next) {
        if (err) {
            console.error(err.stack || err)
            logfmt.namespace({ request_id: req.id }).error(err)
            lib.rollbar.handleError(err)

            res.status(500).json({
                errorDetails: err.toString()
            })
        }

        // By not returning the err we show we've handled it
        next()
    })

    var server = http.createServer(app)

    var io = require('socket.io')(server)

    io.use(passportSocketIo.authorize({
        cookieParser: cookieParser,       // the same middleware you registrer in express
        secret: process.env.COOKIE_SECRET,
        store:        KnexSessionStore
    }));

    require('../src/socket.io.js')(io)

    server.timeout = parseInt(process.env.REQUEST_TIMEOUT || 5000)

    var port = parseInt(process.env.PORT || 5000)
    server.listen(port)
    console.log("Server ready on port %d", port)
})
