var SessionManager = function() {
    this.reset();
};

SessionManager.prototype.PROJECT_REQUEST = 'session-project-request';
SessionManager.prototype.CURRENT_PROJECT = 'session-project';
SessionManager.prototype.newSession = function(socket, sessionId) {
    sessionId = sessionId || this._getNewSessionId();

    this._sessions[sessionId] = [socket];
    this._sessionIdFor[socket.id] = sessionId;
    this._sockets[socket.id] = socket;
    appointLeader(this._sessions[sessionId]);
    return sessionId;
};

SessionManager.prototype.sessionId = function(socketId) {
    return this._sessionIdFor[socketId];
};

SessionManager.prototype.joinSession = function(socketId, sessionId) {
    var socket = this._sockets[socketId],
        session = this._sessions[sessionId];

    if (sessionId === this._sessionIdFor[socket.id]) {
        // nop - socket is already in the given session
        return;
    }

    // Create session if it doesn't exist
    if (!session) {
        return this.newSession(socket, sessionId);
    }

    // Remove the socket from the current session
    this.remove(socket);

    // Add the socket to the new session
    session.push(socket);
    this._sessionIdFor[socket.id] = sessionId;
    socket.isLeader = false;
    socket.send(JSON.stringify({
        type: 'session-id',
        value: sessionId
    }));

    // Load the project for the given socket (from the leader)
    var leader = session.find(socket => socket.isLeader);
    leader.send(JSON.stringify({
        type: this.PROJECT_REQUEST,
        target: socket.id,
        sessionId: sessionId
    }));
};

SessionManager.prototype.onReceivedSessionProject = function(msg) {
    var socket = this._sockets[msg.target],
        sessionId = this._sessionIdFor[msg.target];

    if (socket && sessionId === msg.sessionId) {  // check if current; ow, ignore
        msg.type = this.CURRENT_PROJECT;
        socket.send(JSON.stringify(msg));
    }
};

SessionManager.prototype.remove = function(socket) {
    var sessionId,
        sockets,
        i;

    sessionId = this._sessionIdFor[socket.id];
    sockets = this._sessions[sessionId] || [socket];

    if (sockets.length === 1) {
        delete this._sessions[sessionId];
    } else if (socket.isLeader) {
        i = sockets.indexOf(socket);
        sockets.splice(i, 1);

        socket.isLeader = false;
        appointLeader(sockets);
    }
    delete this._sessionIdFor[socket.id];
};

SessionManager.prototype.getSession = function(socket) {
    var sessionId = this._sessionIdFor[socket.id];
    return this._sessions[sessionId] || null;
};

/////////////////////////// Private ///////////////////////////
var rand = function(len) {
    return Math.floor(Math.random()*Math.pow(10, len)).toString();
};

SessionManager.prototype._getNewSessionId = function() {
    var len = 5,
        id = rand(len);

    while (this._sessions[id]) {
        id = rand(len++);
    }

    return id;
};

var appointLeader = function(sockets) {
    var leader = sockets.find(s => s.readyState === 1);
    if (leader) {
        leader.isLeader = true;
        leader.send(JSON.stringify({
            type: 'leader-appoint'
        }));
    }
};

SessionManager.prototype._printSockets = function(sessionId) {
    var sockets = this._sessions[sessionId];
    if (!sockets) {
        return console.log(`No sockets in ${sessionId}`);
    }
    console.log('Sockets in ' + sessionId);
    sockets.forEach(socket => 
        console.log(`${socket.id} ${socket.isLeader ? '(leader)' : ''}`)
    );
};

SessionManager.prototype.reset = function() {
    this._sessions = {};
    this._sessionIdFor = {};
    this._sockets = {};
};

module.exports = new SessionManager();
