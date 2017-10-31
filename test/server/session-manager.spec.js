
describe.only('SessionManager', function() {
    var sessions = require('../../src/server/session-manager'),
        assert = require('assert'),
        socket,
        init = function() {
            sessions.reset();
            socket = new MockSocket('s1');
        };


    describe('new session', function() {
        beforeEach(init);

        it('should create new session', function() {
            sessions.newSession(socket);
            assert.equal(Object.keys(sessions._sessions).length, 1);
        });

        it('should set the socket to the leader', function() {
            sessions.newSession(socket);
            assert(socket.isLeader);
        });

        it('should send leader-appoint msg', function(done) {
            socket.send = raw => {
                var msg = JSON.parse(raw);
                assert.equal(msg.type, 'leader-appoint');
                done();
            };
            sessions.newSession(socket);
        });

    });

    describe('sessionId', function() {
        beforeEach(init);

        it('should retrieve the session id', function() {
            var actualId,
                sessionId;

            sessions.newSession(socket);
            actualId = Object.keys(sessions._sessions)[0];
            sessionId = sessions.sessionId(socket.id);
            assert.equal(sessionId, actualId);
        });

        it('should not retrieve the session id after removed', function() {
            sessions.newSession(socket);
            sessions.remove(socket);
            sessionId = sessions.sessionId(socket.id);
            assert(!sessionId);
        });
    });

    describe('getSessionId', function() {
        beforeEach(init);

        it('should retrieve the session id', function() {
            var actualId,
                sessionId;

            sessions.newSession(socket);
            actualId = Object.keys(sessions._sessions)[0];
            sessionId = sessions.getSessionId(socket);
            assert.equal(sessionId, actualId);
        });

        it('should not retrieve the session id after removed', function() {
            sessions.newSession(socket);
            sessions.remove(socket);
            sessionId = sessions.getSessionId(socket);
            assert(!sessionId);
        });
    });

    describe('remove', function() {
        var sessionId;

        beforeEach(function() {
            init();
            sessionId = sessions.newSession(socket);
            sessions.remove(socket);
        });

        it('should appoint new leader if it was leader', function() {
            var s2 = new MockSocket('s2');

            sessionId = sessions.newSession(socket);
            sessions.newSession(s2);
            sessions.joinSession(s2.id, sessionId);

            sessions.remove(socket);
        });

        it('should remove session if only member', function() {
            assert(!sessions._sessions[sessionId]);
        });

        it('should not return session id', function() {
            assert(!sessions.sessionId(socket.id));
        });
    });

    describe('getSession', function() {
        beforeEach(init);

        it('should return sockets in the session', function() {
            var sessionId = sessions.newSession(socket),
                s2 = new MockSocket('s2'),
                sockets;

            sessions.newSession(s2),
            sessions.joinSession(s2.id, sessionId);
            sockets = sessions.getSession(socket);

            assert(sockets.includes(socket));
            assert(sockets.includes(s2));
        });
    });

    describe('join session', function() {
        var sessionId,
            oldSessionId,
            s2,
            s3;

        describe('collab count notifications', function() {
            before(function() {
                sessions.reset();

                s2 = new MockSocket('s2');
                s3 = new MockSocket('s3');
                socket = new MockSocket('s1');
                sessionId = sessions.newSession(s2);
                sessions.newSession(s3);
                oldSessionId = sessions.newSession(socket);

                sessions.joinSession(s3.id, oldSessionId);
                sessions.joinSession(socket.id, sessionId);
            });

            it('should notify s2 of new collaborator', function() {
                var collabChange = s2.messages()
                    .find(msg => msg.type === 'session-user-count' && msg.value === 2);

                assert(collabChange);
            });

            it('should notify s3 of collaborator exit', function() {
                var collabChange = s3.messages()
                    .find(msg => msg.type === 'session-user-count' && msg.value === 1);

                assert(collabChange);
            });

            it('should notify s1 of s2', function() {
                var collabChange = socket.messages()
                    .filter(msg => msg.type === 'session-user-count' && msg.value === 2);

                assert.equal(collabChange.length, 2);
            });

        });

        describe('existing session', function() {
            before(function() {
                sessions.reset();

                s2 = new MockSocket('s2');
                socket = new MockSocket('s1');
                sessionId = sessions.newSession(s2);
                oldSessionId = sessions.newSession(socket);

                sessions.joinSession(socket.id, sessionId);
            });

            it('should change socket to non-leader', function() {
                assert(!socket.isLeader);
            });

            it('should set s2 to leader', function() {
                assert(s2.isLeader);
            });

            it('should demote new socket', function() {
                var msg = socket.messages().reverse()
                    .find(msg => msg.type === 'leader-appoint');

                assert.equal(msg.value, false);
            });

            it('should add socket to new session', function() {
                assert.equal(sessionId, sessions.sessionId(socket.id));
            });

            it('should remove socket from old session', function() {
                assert.equal(sessions._sessions[oldSessionId], undefined);
            });

            it('should have 2 unique sockets in session', function() {
                var session = sessions.getSession(socket);

                assert.equal(session.length, 2);
                assert.notEqual.apply(assert, session);
            });

            it('should send socket the new sessionId', function() {
                var lastMsg = socket.message(-1);
                assert.equal(lastMsg.type, 'session-id');
                assert.equal(lastMsg.value, sessionId);
            });

            it('should request project from the leader', function() {
                var lastMsg = s2.message(-1);
                assert.equal(lastMsg.type, 'session-project-request');
                assert.equal(lastMsg.target, socket.id);
            });
        });

        describe('non-existent session', function() {
            before(function() {
                sessions.reset();

                sessionId = 'someSession';
                socket = new MockSocket('s1');
                oldSessionId = sessions.newSession(socket);
                sessions.joinSession(socket.id, sessionId);
            });

            it('should create new session for socket', function() {
                assert.equal(sessionId, sessions.sessionId(socket.id));
            });
        });
    });

});

function MockSocket(id) {
    this.id = id;
    this.readyState = 1;
    this._messages = [];
};

MockSocket.prototype.send = function(msg) {
    this._messages.push(msg);
};

MockSocket.prototype.message = function(index) {
    while (index < 0) {
        index += this._messages.length;
    }
    return JSON.parse(this._messages[index]);
};

MockSocket.prototype.messages = function() {
    return this._messages.map(msg => JSON.parse(msg));
};
