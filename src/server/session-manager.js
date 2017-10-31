var logger = {
    debug: console.log,
    trace: console.log
};

var SessionManager = function() {
    this.reset();
};

SessionManager.prototype.PROJECT_REQUEST = 'session-project-request';
SessionManager.prototype.NEW_SESSION = 'new-session';
SessionManager.prototype.CURRENT_PROJECT = 'openProject';
SessionManager.prototype.newSession = function(socket, sessionId) {
    sessionId = sessionId || this._getNewSessionId();

    this.remove(socket);
    logger.trace(`Creating session ${sessionId} for ${socket.id}`);
    this._sessions[sessionId] = [socket];
    this._sessionIdFor[socket.id] = sessionId;
    this._sockets[socket.id] = socket;
    appointLeader(this._sessions[sessionId]);
    socket.send(JSON.stringify({
        type: 'session-user-count',
        value: 1
    }));
    return sessionId;
};

SessionManager.prototype.sessionId = function(socketId) {
    return this._sessionIdFor[socketId];
};

SessionManager.prototype.joinSession = function(socketId, sessionId) {
    var socket = this._sockets[socketId],
        session = this._sessions[sessionId],
        oldSessionId = this._sessionIdFor[socket.id],
        oldSession = this._sessions[oldSessionId] || [],
        i;

    logger.trace(`${socketId} joining session ${sessionId}`);
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

    // Notify sockets in the old session of the leave
    for (i = oldSession.length; i--;) {
        oldSession[i].send(JSON.stringify({
            type: 'session-user-count',
            value: oldSession.length
        }));
    }

    // Add the socket to the new session
    session.push(socket);
    this._sessionIdFor[socket.id] = sessionId;
    socket.isLeader = false;

    // Notify sockets in the new session of the join
    for (i = session.length; i--;) {
        session[i].send(JSON.stringify({
            type: 'session-user-count',
            value: session.length
        }));
    }

    // demote old leader
    socket.send(JSON.stringify({
        type: 'leader-appoint',
        value: false
    }));
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
    } else {
        i = sockets.indexOf(socket);
        sockets.splice(i, 1);

        if (socket.isLeader) {
            socket.isLeader = false;
            appointLeader(sockets);
        }
    }
    delete this._sessionIdFor[socket.id];
};

SessionManager.prototype.getSession = function(socket) {
    var sessionId = this._sessionIdFor[socket.id];
    return this._sessions[sessionId] || null;
};

SessionManager.prototype.getSessionId = function(socket) {
    var sessionId = this._sessionIdFor[socket.id];
    return sessionId || null;
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
            type: 'leader-appoint',
            value: true
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
    logger.debug('Resetting sessions!');
    this._sessions = {};
    this._sessionIdFor = {};
    this._sockets = {};
};

SessionManager.prototype.init = function(_logger) {
    logger = _logger;
};

module.exports = new SessionManager();
