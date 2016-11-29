/*globals describe*/

describe('Collaboration', function() {
    var path = require('path'),
        assert = require('assert'),
        SnapUndo = require(path.join(__dirname, '..', 'src', 'client', 'undo')),
        UNDO = 1,
        REDO = 2;

    global.SnapCollaborator = {
        applyEvent: event => {
            SnapUndo.record(event);
        }
    };
    beforeEach(function() {
        SnapUndo.eventHistory = [];
        SnapUndo.undoCount = 0;
    });

    it('should remove redo actions on regular event', function() {
        var eventCount = 10,
            i;

        SnapUndo.getInverseEvent = () => {
            return {};
        };

        for (i = 0; i < eventCount; i++) {
            SnapUndo.record({
                type: i
            });
        }

        // undo a few...
        console.log('eventHistory:', SnapUndo.eventHistory.map(e => e.type).join(', '));
        for (i = 7; i--;) {
            console.log('undo...');
            SnapUndo.undo();
        }

        // perform an action
        //for (i = 0; i < 4; i++) {
            SnapUndo.record({
                type: 1000
            });
        //}

        console.log('eventHistory:', SnapUndo.eventHistory.map(e => e.type).join(', '));
        // check the current eventHistory
        // TODO
        var expected = [0, 1, 2, 1000];
        expected.forEach((shouldBe, index) => {
            assert.equal(shouldBe, SnapUndo.eventHistory[index].type);
        });
    });

    it('should remove action on regular event (in undo queue)', function() {
        var eventCount = 10,
            i;

        SnapUndo.getInverseEvent = () => {
            return {};
        };

        for (i = 0; i < eventCount; i++) {
            SnapUndo.record({
                type: i
            });
        }

        // undo a few...
        SnapUndo.undo();

        // perform an action
        //for (i = 0; i < 4; i++) {
            SnapUndo.record({
                type: 1000
            });
        //}

        // check the current eventHistory
        var expected = [0, 1, 2, 3, 4, 5, 6, 7, 8, 1000];
        expected.forEach((shouldBe, index) => {
            assert.equal(shouldBe, SnapUndo.eventHistory[index].type);
        });
    });
});
