var assert = require('assert'),
    sessions = require('./session-manager'),
    rank = 0,
    logger = {
        debug: console.log,
        trace: console.log
    };

var nop = () => {};
sessions.init(logger);

module.exports = {
    enable: function(app, wss, opts) {
        // Basically, when a socket connects, it is initially in it's own session.
        // Other sockets can then join/leave sessions
        var msgFilter,
            record;

        opts = opts || {};
        msgFilter = opts.msgFilter;
        record = opts.record || nop;
        wss.on('connection', socket => {
            socket.on('message', msg => {
                var json = JSON.parse(msg);

                if (msgFilter && !msgFilter(json)) {
                    logger.trace(`filtering out ${json.type} message`);
                    return;
                }

                if (json.type === sessions.PROJECT_REQUEST) {
                    sessions.onReceivedSessionProject(json);
                } else if (json.type === sessions.NEW_SESSION) {
                    let sessionId = sessions.newSession(socket);
                    socket.send(JSON.stringify({
                        type: 'session-id',
                        value: sessionId
                    }));
                } else {
                    var sockets = sessions.getSession(socket);
                    if (!sockets) {
                        assert('session not found for', socket.id);
                    }

                    if (socket.isLeader) {
                        sockets = sockets
                            .filter(socket => socket.readyState === 1)  // is open
                            .filter(s => s !== socket);

                        if (sockets.length) {
                            logger.trace(`sending message to ${sockets.map(s => s.id).join(',')}`);
                        }
                        sockets.forEach(s => {
                                logger.trace(`sending message to ${s.id}`);
                                s.send(msg);
                            });
                    } else {
                        var leader = sockets.find(socket => socket.isLeader);
                        logger.trace(`sending message to leader (${leader.id})`);
                        leader.send(msg);
                    }
                }
                // Add a record event
                record(json, sessions.getSessionId(socket));
            });

            socket.on('close', () => {
                sessions.remove(socket);
            });

            // May not need to send this
            socket.id = `socket_${rank}`;
            socket.send(JSON.stringify({
                type: 'uuid',
                value: socket.id
            }));

            // Add the socket to it's own session
            var sessionId = sessions.newSession(socket);
            logger.trace(`Socket ids are ${Object.keys(sessions._sockets)}`);
            socket.send(JSON.stringify({
                type: 'session-id',
                value: sessionId
            }));

            rank++;
            logger.debug(`Collaboration socket connected! ${socket.id}`);
        });

        app.post('/collaboration/join', function(req, res) {
            var id = req.query.id,
                sessionId = req.query.sessionId;

            res.header('Access-Control-Allow-Origin', '*');
            console.log(`${id} is trying to join ${sessionId}`);
            // join the given collaboration session
            if (!id || !sessionId) {
                return res.status(400).send(`Invalid id or session id`);
            }

            sessions.joinSession(id, sessionId);

            console.log(`Socket ${id} joined session ${sessionId}`);
            return res.sendStatus(200);
        });

    },

    sessions: sessions,
    init: _logger => {
        logger = _logger;
        sessions.init(_logger.fork('sessions'));
    }
};

