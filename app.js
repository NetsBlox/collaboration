var express = require('express'),
    ws = require('ws'),
    path = require('path'),
    assert = require('assert'),
    app = express(),
    sessions = require('./src/server/session-manager'),
    leader,
    rank = 0;

app.use('/', express.static(path.join(__dirname, 'src', 'client')));

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'src', 'client', 'snap.html'));
});

app.post('/collaboration/join', function(req, res) {
    var id = req.query.id,
        sessionId = req.query.sessionId;

    console.log(`${id} is trying to join ${sessionId}`);
    // join the given collaboration session
    if (!id || !sessionId) {
        return res.status(400).send(`Invalid id or session id`);
    }

    sessions.joinSession(id, sessionId);

    console.log(`Socket ${id} joined session ${sessionId}`);
    return res.sendStatus(200);
});

var wss = new ws.Server({
    server: app.listen(8000)
});

// Basically, when a socket connects, it is initially in it's own session.
// Other sockets can then 
wss.on('connection', socket => {
    socket.on('message', msg => {
        var json = JSON.parse(msg);
        if (json.type === sessions.PROJECT_REQUEST) {
            sessions.onReceivedSessionProject(json);
        } else {
            console.log('received:', msg);
            var sockets = sessions.getSession(socket);
            if (!sockets) {
                assert('session not found for', socket.id);
            }

            if (socket.isLeader) {
                sockets
                    .filter(socket => socket.readyState === 1)  // is open
                    .filter(s => s !== socket)
                    .forEach(s => s.send(msg));
            } else {
                var leader = sockets.find(socket => socket.isLeader);
                leader.send(msg);
            }
        }
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
    socket.send(JSON.stringify({
        type: 'session-id',
        value: sessionId
    }));

    rank++;
});
