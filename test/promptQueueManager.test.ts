import test from 'node:test';
import assert from 'node:assert/strict';
import { PromptQueueManager } from '../src/core/orchestrator/PromptQueueManager';
import { createPrompt } from '../src/core/types';
import { createPromptForTask, MemoryStateManager } from './helpers';

test('createPrompt defaults to manual handoff mode', () => {
    const prompt = createPrompt({
        taskId: 'task_1',
        title: 'Manual prompt',
        systemPrompt: 'System',
        content: 'Content',
        targetAgent: 'claude',
        order: 0
    });

    assert.equal(prompt.executionMode, 'manual');
    assert.equal(prompt.targetAgent, 'claude');
});

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
    assert.equal(summary.completed, 0);
    assert.equal(summary.cancelled, 1);
});

test('PromptQueueManager retries a failed prompt with a clean approved state', async () => {
    const prompt = {
        ...createPromptForTask('task_1', 'prompt_failed'),
        status: 'failed' as const,
        provider: 'Gemini',
        errorMessage: 'models/gemini-1.5-flash not found',
        responseText: 'stale response',
        executionResult: {
            errorMessage: 'models/gemini-1.5-flash not found'
        }
    };
    const stateManager = new MemoryStateManager({ prompts: [prompt] });
    const queueManager = new PromptQueueManager(stateManager);

    await queueManager.retryFailed(prompt.id);
    const state = await stateManager.getState();
    const updatedPrompt = state.prompts[0];

    assert.equal(updatedPrompt?.status, 'approved');
    assert.equal(updatedPrompt?.errorMessage, undefined);
    assert.equal(updatedPrompt?.executionResult, undefined);
    assert.equal(updatedPrompt?.responseText, undefined);
    assert.equal(updatedPrompt?.provider, undefined);
    assert.ok(updatedPrompt?.approvedAt);
});

async function waitUntil(predicate: () => Promise<boolean>, timeoutMs = 2000): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        if (await predicate()) {
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 20));
    }

    throw new Error('Timed out waiting for condition.');
}
