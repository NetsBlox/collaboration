var express = require('express'),
    ws = require('ws'),
    path = require('path'),
    assert = require('assert'),
    app = express(),
    sessions = {},
    sessionIdFor = {},
    sockets = {},
    leader,
    rank = 0;

app.use('/', express.static(path.join(__dirname, 'src', 'client')));

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'src', 'client', 'snap.html'));
});

app.get('/collaboration/session', function(req, res) {
    var id = req.query.id,
        sessionId;

    // request the given sessionId
    if (req.query.id) {
        sessionId = sessionIdFor[id];
        if (!sessionId) {
            return res.send('ERROR: Could not find session for ' + id);
        }
        return res.send(sessionId);
    }
    return res.status(400).send('ERROR: No socket id provided');
});

app.post('/collaboration/join', function(req, res) {
    var id = req.query.id,
        sessionId = req.query.sessionId,
        socket = sockets[id],
        session = sessions[sessionId];

    console.log(`${id} is trying to join ${sessionId}`);
    // join the given collaboration session
    if (!id || !sessionId || !sessions[sessionId]) {
        return res.status(400).send(`Invalid id or session id`);
    }

    if (sessionId === sessionIdFor[socket.id]) {
        // nop - socket is already in the given session
        return res.sendStatus(200);
    }

    // Remove the socket from the current session
    removeFromCurrentSession(socket);

    // Add the socket to the new session
    session.push(socket);
    sessionIdFor[socket.id] = sessionId;
    socket.isLeader = false;

    // Load the project for the given socket (from the leader)
    // TODO

    console.log(`Socket ${id} joined session ${sessionId}`);
    return res.sendStatus(200);
});

var rand = function(len) {
    return Math.floor(Math.random()*Math.pow(10, len)).toString();
};

var getNewSessionId = function() {
    var len = 5,
        id = rand(len);

    while (sessions[id]) {
        id = rand(len++);
    }

    return id;
};

var removeFromCurrentSession = function(socket) {
    var sessionId,
        sockets,
        i;

    sessionId = sessionIdFor[socket.id];
    sockets = sessions[sessionId];

    if (sockets.length === 1) {
        delete sessions[sessionId];
    } else if (socket === leader) {
        i = sockets.indexOf(socket);
        sockets.splice(i, 1);

        socket.isLeader = false;
        appointLeader(sockets);
    }
    delete sessionIdFor[socket.id];
};

var wss = new ws.Server({
    server: app.listen(8000)
});

var appointLeader = function(sockets) {
    var leader = sockets.find(s => s.readyState === 1);
    if (leader) {
        leader.isLeader = true;
        leader.send(JSON.stringify({
            type: 'leader-appoint'
        }));
    }
};

var printSockets = function(sessionId) {
    var sockets = sessions[sessionId];
    if (!sockets) {
        return console.log(`No sockets in ${sessionId}`);
    }
    console.log('Sockets in ' + sessionId);
    sockets.forEach(socket => 
        console.log(`${socket.id} ${socket.isLeader ? '(leader)' : ''}`)
    );
};

// Basically, when a socket connects, it is initially in it's own session.
// Other sockets can then 
wss.on('connection', socket => {
    socket.on('message', msg => {
        console.log('received:', msg);
        sessionId = sessionIdFor[socket.id];
        var sockets = sessions[sessionId];
        printSockets(sessionId);
        if (!sockets) {
            assert('session not found for', socket.id);
        }

        if (socket.isLeader) {
            sockets
                .filter(socket => socket.readyState === 1)  // is open
                .filter(s => s !== leader)
                .forEach(s => s.send(msg));
        } else {
            var leader = sockets.find(socket => socket.isLeader);
            leader.send(msg);
        }
    });

    socket.on('close', () => {
        removeFromCurrentSession(socket);
    });

    // May not need to send this
    socket.id = `socket_${rank}`;
    socket.send(JSON.stringify({
        type: 'uuid',
        value: socket.id
    }));

    // Add the socket to it's own session
    sessionId = getNewSessionId();
    sessions[sessionId] = [socket];
    sessionIdFor[socket.id] = sessionId;
    sockets[socket.id] = socket;
    appointLeader(sessions[sessionId]);

    rank++;
});
