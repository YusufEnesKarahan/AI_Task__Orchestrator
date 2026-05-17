import test from 'node:test';
import assert from 'node:assert/strict';
import { ActionRequest } from '../src/core/types';
import { ApprovalManager } from '../src/services/approval/ApprovalManager';
import { MemoryStateManager } from './helpers';

test('ApprovalManager reuses an existing pending approval for the same task and action summary', async () => {
    const stateManager = new MemoryStateManager();
    const manager = new ApprovalManager(stateManager);
    const firstAction: ActionRequest = {
        id: 'action_1',
        type: 'run_terminal_command',
        payload: { command: 'npm install express' }
    };
    const repeatedAction: ActionRequest = {
        id: 'action_2',
        type: 'run_terminal_command',
        payload: { command: 'npm install express' }
    };

    const firstApproval = await manager.createApprovalRequest(firstAction, 'task_1');
    const repeatedApproval = await manager.createApprovalRequest(repeatedAction, 'task_1');
    const state = await stateManager.getState();

    assert.ok(firstApproval);
    assert.equal(repeatedApproval?.id, firstApproval.id);
    assert.equal(state.approvals.length, 1);
    assert.equal(state.approvals[0]?.actionSummary, 'Terminal command: npm install express');
});

test('ApprovalManager creates a new approval after the previous matching approval is resolved', async () => {
    const stateManager = new MemoryStateManager();
    const manager = new ApprovalManager(stateManager);
    const action: ActionRequest = {
        id: 'action_1',
        type: 'run_terminal_command',
        payload: { command: 'npm install express' }
    };

    const firstApproval = await manager.createApprovalRequest(action, 'task_1');
    assert.ok(firstApproval);
    await manager.resolveApproval(firstApproval.id, true);

    const nextApproval = await manager.createApprovalRequest({ ...action, id: 'action_2' }, 'task_1');
    const state = await stateManager.getState();

    assert.ok(nextApproval);
    assert.notEqual(nextApproval.id, firstApproval.id);
    assert.equal(state.approvals.length, 2);
    assert.equal(state.approvals.filter((approval) => approval.status === 'pending').length, 1);
});
