var express = require('express'),
    ws = require('ws'),
    path = require('path'),
    collaboration = require('./src/server/collaboration'),
    port = +process.env.PORT,
    app = express();

if (isNaN(port)) {
    port = 8000;
}

app.use('/', express.static(path.join(__dirname, 'src', 'client')));

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'src', 'client', 'snap.html'));
});

console.log(`listening on port ${port}`);
var wss = new ws.Server({
    server: app.listen(port)
});

// configure the websocket and app
collaboration.enable(app, wss);

module.exports = {
    app: app,
    wss: wss
};
