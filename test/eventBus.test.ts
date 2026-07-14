import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/shared/events/EventBus';

test('EventBus.getInstance returns a singleton instance', () => {
    const bus1 = EventBus.getInstance();
    const bus2 = EventBus.getInstance();
    assert.equal(bus1, bus2);
});

test('EventBus can publish and subscribe to events', () => {
    const bus = EventBus.getInstance();
    let receivedPayload: any = null;

    const unsubscribe = bus.on('WorkspaceLoaded', (payload) => {
        receivedPayload = payload;
    });

    bus.emit('WorkspaceLoaded', { workspaceRoot: '/test/path' });

    assert.deepEqual(receivedPayload, { workspaceRoot: '/test/path' });

    unsubscribe();
});
