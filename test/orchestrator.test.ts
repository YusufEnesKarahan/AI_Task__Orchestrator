import test from 'node:test';
import assert from 'node:assert/strict';
import { createPromptForTask, createTask, installVscodeMock, MemoryStateManager } from './helpers';

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

test('Orchestrator.generateAllPrompts persists the target agent used for the prompt', async () => {
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

    orchestrator.setTargetAgent('claude');
    await orchestrator.generateAllPrompts();
    orchestrator.setTargetAgent('codex');
    const state = await stateManager.getState();

    assert.equal(state.prompts[0]?.targetAgent, 'claude');
    assert.match(state.prompts[0]?.content || '', /Claude/);
});

test('Orchestrator.markPromptSent moves manual prompts into result waiting state', async () => {
    installVscodeMock();
    const { Orchestrator } = await import('../src/core/orchestrator/Orchestrator.js');
    const prompt = {
        ...createPromptForTask('task_1', 'prompt_1'),
        status: 'ready_for_manual_send' as const,
        executionMode: 'manual' as const
    };
    const stateManager = new MemoryStateManager({ prompts: [prompt] });
    const orchestrator = new Orchestrator(stateManager, process.cwd());

    await orchestrator.initialize({
        selection: 'mock',
        openAiModel: 'gpt-4o-mini',
        geminiModel: 'gemini-2.5-flash',
        timeoutMs: 1000,
        maxRetries: 0,
        apiKeys: {}
    });

    await orchestrator.markPromptSent(prompt.id);
    const state = await stateManager.getState();

    assert.equal(state.prompts[0]?.status, 'awaiting_manual_result');
});
