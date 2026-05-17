import test from 'node:test';
import assert from 'node:assert/strict';
import { installVscodeMock } from './helpers';

test('resolveGeminiModel falls back from retired default model', async () => {
    installVscodeMock();
    const { DEFAULT_GEMINI_MODEL, resolveGeminiModel } = await import('../src/providers/providerConfig.js');

    assert.equal(resolveGeminiModel('gemini-1.5-flash'), DEFAULT_GEMINI_MODEL);
    assert.equal(resolveGeminiModel('models/gemini-1.5-flash'), DEFAULT_GEMINI_MODEL);
    assert.equal(resolveGeminiModel('   '), DEFAULT_GEMINI_MODEL);
});

test('resolveGeminiModel preserves explicit current model setting', async () => {
    installVscodeMock();
    const { resolveGeminiModel } = await import('../src/providers/providerConfig.js');

    assert.equal(resolveGeminiModel('models/gemini-2.5-flash'), 'gemini-2.5-flash');
    assert.equal(resolveGeminiModel('gemini-2.0-flash'), 'gemini-2.0-flash');
});
