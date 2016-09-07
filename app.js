var express = require('express'),
    ws = require('ws'),
    path = require('path'),
    app = express(),
    sockets = [],
    leader,
    rank = 0;

app.use('/', express.static(path.join(__dirname, 'src', 'client')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'client', 'snap.html'));
});

var wss = new ws.Server({
    server: app.listen(8000)
});

var appointLeader = function() {
    leader = sockets[0];
    leader.send(JSON.stringify({
        type: 'leader-appoint'
    });
};

wss.on('connection', socket => {
    socket.send(JSON.stringify({
        type: 'rank',
        value: rank
    }));
    rank++;

    sockets.push(socket);
    if (sockets.length === 1) {
        appointLeader();
    }
    socket.on('message', msg => {
        sockets.forEach(s => s.send(msg));
    });

    socket.on('close', () => {
        var i = sockets.indexOf(socket);
        sockets.splice(i, 1);
        if (sockets.length === 0) {
            rank = 0;
        } else if (socket === leader) {
            appointLeader();
        }
    });
});
    
