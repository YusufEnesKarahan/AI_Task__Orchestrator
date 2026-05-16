import test from 'node:test';
import assert from 'node:assert/strict';
import { PromptQueueManager } from '../src/core/orchestrator/PromptQueueManager';
import { createPromptForTask, MemoryStateManager } from './helpers';

test('PromptQueueManager cancels a manual prompt wait without hanging the queue', async () => {
    const prompt = {
        ...createPromptForTask('task_1', 'prompt_1'),
        status: 'approved' as const,
        executionMode: 'manual' as const
    };
    const stateManager = new MemoryStateManager({ prompts: [prompt] });
    const queueManager = new PromptQueueManager(stateManager);

    const execution = queueManager.executeQueue();
    await waitUntil(async () => {
        const state = await stateManager.getState();
        return state.prompts[0]?.status === 'ready_for_manual_send';
    });

    queueManager.requestCancel();
    const summary = await execution;
    const finalState = await stateManager.getState();

    assert.equal(queueManager.isRunning(), false);
    assert.equal(finalState.prompts[0]?.status, 'cancelled');
    assert.equal(summary.total, 1);
});

async function waitUntil(predicate: () => Promise<boolean>, timeoutMs = 2000): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        if (await predicate()) {
            return;
        }

        await new Promise(resolve => setTimeout(resolve, 20));
    }

    throw new Error('Timed out waiting for condition.');
}
