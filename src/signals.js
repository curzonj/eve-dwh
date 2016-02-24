'use strict';

const events = require('events')
const logfmt = require('logfmt')

const dispatcher = new events()

module.exports = {
    setup: () => {
        process.on('SIGTERM', () => {
            const logger = logfmt.namespace({ fn: "SIGTERM" })
            const timer = logger.time()

            logger.log({ at: "start" })
            console.log('Got SIGTERM from Heroku, exiting')

            dispatcher.emit("exit")

            timer.log({ at: "finished" })

            process.exit(0)
        })
    },
    onExit: (fn) => {
        dispatcher.on("exit", fn)
    }
}
