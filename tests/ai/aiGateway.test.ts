import { AIGateway } from '../../src/ai/gateway/AIGateway';
import { ModelRegistry } from '../../src/ai/registry/ModelRegistry';
import { AIGenerateRequest } from '../../src/ai/shared/aiTypes';
import { SecretManager } from '../../src/ai/shared/SecretManager';
import { describe, test, before } from 'node:test';
import * as assert from 'node:assert';

describe('AIGateway and Router Tests', () => {
    before(() => {
        // Testler için sahte secret manager ayarla
        const dummyStorage = {
            get: async () => 'test-key',
            store: async () => {},
            delete: async () => {}
        };
        SecretManager.getInstance().initialize(dummyStorage);
    });

    test('Should return mock model from registry', () => {
        const registry = ModelRegistry.getInstance();
        const models = registry.getModelsByProvider('mock');
        assert.ok(models.length > 0);
        assert.strictEqual(models[0].id, 'mock-model');
    });

    test('Should generate via mock provider correctly', async () => {
        const gateway = AIGateway.getInstance();
        const request: AIGenerateRequest = {
            modelId: 'mock-model',
            messages: [
                { role: 'user', content: 'Hello' }
            ]
        };

        const response = await gateway.generate(request);
        assert.strictEqual(response.content, 'Mock response');
        assert.ok(response.durationMs >= 0);
    });

    test('Should check health of mock provider successfully', async () => {
        const gateway = AIGateway.getInstance();
        const health = await gateway.checkHealth('mock-model');
        assert.strictEqual(health.status, 'healthy');
        assert.strictEqual(health.provider, 'mock');
    });
});
