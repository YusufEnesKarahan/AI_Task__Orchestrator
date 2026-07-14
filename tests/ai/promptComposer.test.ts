import { PromptComposer } from '../../src/ai/composer/PromptComposer';
import { PromptSectionBuilder } from '../../src/ai/composer/PromptSectionBuilder';
import { PromptOptimizer } from '../../src/ai/composer/PromptOptimizer';
import { PromptValidator } from '../../src/ai/composer/PromptValidator';
import { describe, test } from 'node:test';
import * as assert from 'node:assert';

describe('Prompt Composer and Utilities Tests', () => {
    test('PromptSectionBuilder should build correct sections with priorities', () => {
        const builder = new PromptSectionBuilder();
        const role = builder.buildSystemRole('You are an AI.');
        assert.strictEqual(role.type, 'role');
        assert.strictEqual(role.priority, 100);
        assert.strictEqual(role.content, 'You are an AI.');
    });

    test('PromptComposer should sort sections by priority and combine', () => {
        const composer = new PromptComposer();
        composer.addSection({ type: 'rules', content: 'Rule 1', priority: 10 });
        composer.addSection({ type: 'role', content: 'You are AI', priority: 100 });
        
        const combined = composer.composeString();
        // Role should be first due to priority 100 > 10
        assert.ok(combined.indexOf('ROLE') < combined.indexOf('RULES'));
        assert.ok(combined.includes('You are AI'));
        assert.ok(combined.includes('Rule 1'));
    });

    test('PromptOptimizer should remove extra newlines', () => {
        const optimizer = new PromptOptimizer();
        const messy = "Hello\n\n\n\nWorld   \n";
        const cleaned = optimizer.optimize(messy);
        assert.strictEqual(cleaned, "Hello\n\nWorld");
    });

    test('PromptValidator should validate token limits', () => {
        const validator = new PromptValidator();
        const messages = [{ role: 'user' as const, content: 'a'.repeat(1000) }]; // ~250 tokens
        
        // mock-model context limit is 8192, so 250 is well within limits
        const isValid = validator.validate('mock-model', messages);
        assert.strictEqual(isValid, true);
    });
});
