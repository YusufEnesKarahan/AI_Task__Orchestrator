import test from 'node:test';
import assert from 'node:assert/strict';
import { createTask, installVscodeMock, MemoryStateManager } from './helpers';

test('Orchestrator.generateAllPrompts is idempotent per task', async () => {
    installVscodeMock();
    const { Orchestrator } = await import('../src/core/orchestrator/Orchestrator.js');
    const task = createTask('task_1');
    const stateManager = new MemoryStateManager({ tasks: [task] });
    const orchestrator = new Orchestrator(stateManager, process.cwd());

    await orchestrator.initialize({
        selection: 'mock',
        openAiModel: 'gpt-4o-mini',
        geminiModel: 'gemini-2.5-flash',
        timeoutMs: 1000,
        maxRetries: 0,
        apiKeys: {}
    });

    await orchestrator.generateAllPrompts();
    await orchestrator.generateAllPrompts();
    const state = await stateManager.getState();

    assert.equal(state.prompts.length, 1);
    assert.equal(state.prompts[0]?.taskId, task.id);
});
