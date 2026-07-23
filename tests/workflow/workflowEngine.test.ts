import { describe, test, before, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import { WorkflowEngine } from '../../src/workflow/WorkflowEngine';
import { WorkflowRegistry } from '../../src/workflow/core/WorkflowRegistry';
import { EventBus } from '../../src/shared/events/EventBus';
import { AgentRegistry } from '../../src/agents/core/AgentRegistry';

const TEMP_WORKSPACE = path.join(__dirname, '..', '..', 'scratch', 'temp_workspace_workflow_test');

class MockPlanner {
    public readonly id = 'planner';
    public readonly profile = 'planner' as any;
    public async run(input: any) {
        return { success: true, output: 'Planned successfully' };
    }
}

describe('Workflow Engine Tests', () => {

    before(() => {
        if (!fs.existsSync(TEMP_WORKSPACE)) {
            fs.mkdirSync(TEMP_WORKSPACE, { recursive: true });
        }
        AgentRegistry.getInstance().register(new MockPlanner());
    });

    beforeEach(() => {
        const cleanDir = (dir: string) => {
            if (!fs.existsSync(dir)) return;
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                if (item === '.aios') continue;
                try {
                    if (fs.statSync(fullPath).isDirectory()) {
                        cleanDir(fullPath);
                        fs.rmdirSync(fullPath);
                    } else {
                        fs.unlinkSync(fullPath);
                    }
                } catch (e) {
                    // Ignore locked resource errors during test cleanup
                }
            }
        };
        cleanDir(TEMP_WORKSPACE);
    });

    // ─── 1. Basic Workflow Execution ─────────────────────────────────────────
    test('should run Feature Development workflow successfully', async () => {
        const engine = new WorkflowEngine(TEMP_WORKSPACE);
        
        WorkflowRegistry.getInstance().register({
            name: 'Test Workflow',
            description: 'Simple test flow',
            steps: [
                {
                    name: 'Step 1',
                    type: 'execution',
                    payload: { agentId: 'planner', taskDescription: 'Do planning' }
                },
                {
                    name: 'Step 2',
                    type: 'action',
                    payload: { type: 'create_file', payload: { path: 'w_test.txt', content: 'workflow data' } }
                }
            ]
        });

        const success = await engine.runWorkflow('Test Workflow');
        assert.strictEqual(success, true);
        assert.ok(fs.existsSync(path.join(TEMP_WORKSPACE, 'w_test.txt')));
    });

    // ─── 2. Conditional Branching ────────────────────────────────────────────
    test('should skip step when if condition is false', async () => {
        const engine = new WorkflowEngine(TEMP_WORKSPACE);

        WorkflowRegistry.getInstance().register({
            name: 'Conditional Workflow',
            description: 'Conditional step flow',
            steps: [
                {
                    name: 'Step A',
                    type: 'execution',
                    payload: { agentId: 'planner', taskDescription: 'A' }
                },
                {
                    name: 'Step B',
                    type: 'action',
                    payload: { type: 'create_file', payload: { path: 'skip.txt', content: 'should not exist' } },
                    if: (state) => false // Koşul yanlış, çalışmamalı
                }
            ]
        });

        const success = await engine.runWorkflow('Conditional Workflow');
        assert.strictEqual(success, true);
        assert.ok(!fs.existsSync(path.join(TEMP_WORKSPACE, 'skip.txt')));
    });

    // ─── 3. Retry Flow ───────────────────────────────────────────────────────
    test('should retry step up to maxRetries on failure', async () => {
        const engine = new WorkflowEngine(TEMP_WORKSPACE);
        
        let attempts = 0;
        AgentRegistry.getInstance().register({
            id: 'unstable_agent',
            profile: 'planner' as any,
            run: async (input: any) => {
                attempts++;
                if (attempts < 2) throw new Error('First try fail');
                return { success: true, output: 'Success' };
            }
        });

        WorkflowRegistry.getInstance().register({
            name: 'Retry Workflow',
            description: 'Retry flow',
            steps: [
                {
                    name: 'Step Retry',
                    type: 'execution',
                    payload: { agentId: 'unstable_agent' },
                    maxRetries: 2
                }
            ]
        });

        const success = await engine.runWorkflow('Retry Workflow');
        assert.strictEqual(success, true);
        assert.strictEqual(attempts, 2);
    });

    // ─── 4. Rollback Flow ────────────────────────────────────────────────────
    test('should trigger transaction rollback on step action failure', async () => {
        const engine = new WorkflowEngine(TEMP_WORKSPACE);

        WorkflowRegistry.getInstance().register({
            name: 'Rollback Workflow',
            description: 'Rollback flow',
            steps: [
                {
                    name: 'Step 1 - Create File',
                    type: 'action',
                    payload: { type: 'create_file', payload: { path: 'rollback_test.txt', content: 'roll' } },
                    failurePolicy: 'rollback'
                },
                {
                    name: 'Step 2 - Fail Action',
                    type: 'action',
                    payload: { type: 'apply_patch', payload: { path: 'missing.txt', patch: 'diff' } },
                    failurePolicy: 'rollback'
                }
            ]
        });

        const success = await engine.runWorkflow('Rollback Workflow');
        assert.strictEqual(success, false);
        // İlk adımda oluşturulan dosya rollback sonucunda silinmiş olmalı
        assert.ok(!fs.existsSync(path.join(TEMP_WORKSPACE, 'rollback_test.txt')));
    });

    // ─── 5. Metrics & EventBus ───────────────────────────────────────────────
    test('should record metrics and dispatch workflow EventBus events', async () => {
        const engine = new WorkflowEngine(TEMP_WORKSPACE);
        const eventBus = EventBus.getInstance();
        const events: string[] = [];

        const unsub = [
            eventBus.on('WorkflowStarted', () => events.push('Started')),
            eventBus.on('WorkflowStepStarted', () => events.push('StepStarted')),
            eventBus.on('WorkflowStepCompleted', () => events.push('StepCompleted')),
            eventBus.on('WorkflowCompleted', () => events.push('Completed'))
        ];

        WorkflowRegistry.getInstance().register({
            name: 'Events Workflow',
            description: 'Events flow',
            steps: [
                {
                    name: 'Step 1',
                    type: 'execution',
                    payload: { agentId: 'planner' }
                }
            ]
        });

        await engine.runWorkflow('Events Workflow');
        unsub.forEach(fn => fn());

        assert.ok(events.includes('Started'));
        assert.ok(events.includes('StepStarted'));
        assert.ok(events.includes('StepCompleted'));
        assert.ok(events.includes('Completed'));

        const metrics = engine.getMetrics();
        assert.ok(metrics.totalWorkflows > 0);
    });
});
