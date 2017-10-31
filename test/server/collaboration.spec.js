describe('collaboration', function() {
    const request = require('supertest');
    const app = require('../../app').app;

    it('should allow cross origin requests', function(done) {
        request(app)
            .post('/collaboration/join')
            .expect('Access-Control-Allow-Origin', '*')
            .end(err => done(err));
    });
});
