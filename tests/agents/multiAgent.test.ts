import { describe, test, before, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import { AgentManager } from '../../src/agents/core/AgentManager';
import { AgentRegistry } from '../../src/agents/core/AgentRegistry';
import { AgentRouter } from '../../src/agents/core/AgentRouter';
import { AgentPipeline } from '../../src/agents/core/AgentPipeline';
import { EventBus } from '../../src/shared/events/EventBus';
import { SecretManager } from '../../src/ai/shared/SecretManager';

const TEMP_WORKSPACE = path.join(__dirname, '..', '..', 'scratch', 'temp_workspace_agent_test');

describe('Multi-Agent Core Tests', () => {

    before(() => {
        // Setup temp workspace
        if (!fs.existsSync(TEMP_WORKSPACE)) {
            fs.mkdirSync(TEMP_WORKSPACE, { recursive: true });
        }

        // Initialize SecretManager with mock storage
        SecretManager.getInstance().initialize({
            get: async () => 'mock-key',
            store: async () => {},
            delete: async () => {}
        });
    });

    beforeEach(() => {
        AgentRegistry.getInstance().clear();
    });

    // ─── 1. Registry & Manager Tests ─────────────────────────────────────────
    test('AgentManager should register default agents to registry', () => {
        const manager = new AgentManager(TEMP_WORKSPACE);
        const registry = AgentRegistry.getInstance();

        assert.ok(registry.getAgent('planner_agent'));
        assert.ok(registry.getAgent('architecture_agent'));
        assert.ok(registry.getAgent('prompt_engineer_agent'));
        assert.ok(registry.getAgent('reviewer_agent'));
        assert.ok(registry.getAgent('memory_manager_agent'));
    });

    // ─── 2. Router Tests ─────────────────────────────────────────────────────
    test('AgentRouter should map review description to reviewer agent', () => {
        const manager = new AgentManager(TEMP_WORKSPACE); // registers defaults
        const router = new AgentRouter(TEMP_WORKSPACE);

        const agent = router.route('Kod kalitesi ve PR incelemesi yap');
        assert.strictEqual(agent.profile, 'reviewer');
    });

    test('AgentRouter should map architecture description to architect agent', () => {
        const manager = new AgentManager(TEMP_WORKSPACE);
        const router = new AgentRouter(TEMP_WORKSPACE);

        const agent = router.route('Katmanlı mimari uyumluluk analizi ve import kontrolleri');
        assert.strictEqual(agent.profile, 'architect');
    });

    // ─── 3. Pipeline & Chaining Integration Tests ────────────────────────────
    test('AgentPipeline should chain Planner -> Architecture -> PromptEngineer -> Reviewer -> MemoryManager', async () => {
        const manager = new AgentManager(TEMP_WORKSPACE);
        const pipeline = manager.createDefaultPipeline('test_integration_pipeline');

        // Events listeners tracking
        const eventsReceived: string[] = [];
        const eventBus = EventBus.getInstance();

        const unsubscribes = [
            eventBus.on('PipelineStarted', () => eventsReceived.push('PipelineStarted')),
            eventBus.on('PipelineStepCompleted', (p) => eventsReceived.push(`PipelineStepCompleted_${p.agentId}`)),
            eventBus.on('PipelineCompleted', (p) => {
                eventsReceived.push('PipelineCompleted');
                assert.strictEqual(p.success, true);
            }),
            eventBus.on('AgentRunStarted', (p) => eventsReceived.push(`AgentRunStarted_${p.agentId}`))
        ];

        // Run execution inputs
        const result = await pipeline.run({
            taskDescription: 'Yeni kullanıcı paneli ekranını implement et',
            inputs: {
                // mock memory values
                decision: {
                    title: 'Sprint 7 Multi-Agent Decision',
                    reason: 'Orchestrating agent workflows securely'
                },
                journal: {
                    summary: 'Created multi agent core architecture',
                    why: 'Required for sprint 7 delivery'
                }
            }
        });

        // Cleanup events
        unsubscribes.forEach(unsub => unsub());

        // Assertions
        assert.strictEqual(result.success, true);
        assert.ok(result.data);
        
        // Assert that events were published in correct sequences
        assert.ok(eventsReceived.includes('PipelineStarted'));
        assert.ok(eventsReceived.includes('PipelineStepCompleted_planner_agent'));
        assert.ok(eventsReceived.includes('PipelineStepCompleted_architecture_agent'));
        assert.ok(eventsReceived.includes('PipelineStepCompleted_prompt_engineer_agent'));
        assert.ok(eventsReceived.includes('PipelineStepCompleted_reviewer_agent'));
        assert.ok(eventsReceived.includes('PipelineStepCompleted_memory_manager_agent'));
        assert.ok(eventsReceived.includes('PipelineCompleted'));

        // Verify outputs of individual agents reached final results
        assert.ok(result.data.plan); // planner output
        assert.ok(result.data.composedPrompt); // prompt engineer output
        assert.ok(result.data.decision); // memory manager decision output
    });

    // ─── 4. Standalone Task Routing ──────────────────────────────────────────
    test('AgentManager runTask should route review standalone task to Reviewer', async () => {
        const manager = new AgentManager(TEMP_WORKSPACE);
        const res = await manager.runTask('Kod incelemesi ve TODO analizi gerçekleştir', {
            artifactToReview: '// TODO: Fix this memory leak later',
            requireTests: false
        });

        assert.strictEqual(res.success, true);
        assert.ok(res.data?.issuesFound);
        assert.ok(res.data.issuesFound.length > 0);
        assert.ok(res.data.issuesFound[0].includes('TODO'));
    });
});
