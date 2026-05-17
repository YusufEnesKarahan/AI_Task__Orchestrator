import test from 'node:test';
import assert from 'node:assert/strict';
import { PromptGenerator } from '../src/core/orchestrator/PromptGenerator';
import { createTask } from './helpers';

test('PromptGenerator includes Codex handoff guidance', () => {
    const generator = new PromptGenerator();
    const prompt = generator.generate(createTask('task_1'), undefined, 'codex');

    assert.equal(prompt.targetAgent, 'codex');
    assert.match(prompt.userPrompt, /# TARGET AGENT/);
    assert.match(prompt.userPrompt, /Codex/);
    assert.match(prompt.userPrompt, /minimal diffs/i);
    assert.match(prompt.systemPrompt, /file-level changes/i);
});

test('PromptGenerator includes Claude handoff guidance', () => {
    const generator = new PromptGenerator();
    const prompt = generator.generate(createTask('task_1'), undefined, 'claude');

    assert.equal(prompt.targetAgent, 'claude');
    assert.match(prompt.userPrompt, /Claude/);
    assert.match(prompt.userPrompt, /architecture and UX/i);
    assert.match(prompt.systemPrompt, /risk analysis/i);
});
