import test from 'node:test';
import assert from 'node:assert/strict';
import { installVscodeMock } from './helpers';

test('createProvider uses OpenAI model when OpenAI is selected', async () => {
    installVscodeMock();
    const { createProvider } = await import('../src/providers/createProvider.js');

    const result = createProvider({
        selection: 'openai',
        openAiModel: 'gpt-4o-mini',
        geminiModel: 'gemini-1.5-flash',
        timeoutMs: 1000,
        maxRetries: 0,
        apiKeys: {
            openai: 'openai-key',
            gemini: 'gemini-key'
        }
    });

    assert.equal(result.status.active, 'openai');
    assert.equal(result.status.label, 'OpenAI · gpt-4o-mini');
    assert.equal(result.provider?.providerName, 'OpenAI');
    assert.equal(result.provider?.model, 'gpt-4o-mini');
});

test('createProvider normalizes retired Gemini model before status and provider creation', async () => {
    installVscodeMock();
    const { createProvider } = await import('../src/providers/createProvider.js');
    const { DEFAULT_GEMINI_MODEL } = await import('../src/providers/providerConfig.js');

    const result = createProvider({
        selection: 'gemini',
        openAiModel: 'gpt-4o-mini',
        geminiModel: 'gemini-1.5-flash',
        timeoutMs: 1000,
        maxRetries: 0,
        apiKeys: {
            gemini: 'gemini-key'
        }
    });

    assert.equal(result.status.active, 'gemini');
    assert.equal(result.status.label, `Gemini · ${DEFAULT_GEMINI_MODEL}`);
    assert.equal(result.provider?.providerName, 'Gemini');
    assert.equal(result.provider?.model, DEFAULT_GEMINI_MODEL);
});
