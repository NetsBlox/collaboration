var express = require('express'),
    ws = require('ws'),
    path = require('path'),
    collaboration = require('./src/server/collaboration'),
    app = express();

app.use('/', express.static(path.join(__dirname, 'src', 'client')));

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'src', 'client', 'snap.html'));
});

var wss = new ws.Server({
    server: app.listen(8000)
});

// configure the websocket and app
collaboration.enable(app, wss);
