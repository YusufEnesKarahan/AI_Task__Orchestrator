import { describe, test, before, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import { ExecutionEngine } from '../../src/execution/ExecutionEngine';
import { ExecutionGraph } from '../../src/execution/core/ExecutionGraph';
import { EventBus } from '../../src/shared/events/EventBus';
import { AgentRegistry } from '../../src/agents/core/AgentRegistry';
import { SecretManager } from '../../src/ai/shared/SecretManager';

const TEMP_WORKSPACE = path.join(__dirname, '..', '..', 'scratch', 'temp_workspace_exec_test');

// Testler için yapay bir yavaş ajan (delay agent) tanımlayalım
class DelayAgent {
    public readonly id = 'delay_agent';
    public readonly profile = 'planner' as any;
    private failOnAttempts = 0;
    private runCount = 0;

    constructor(private readonly delayMs: number = 10, failAttempts: number = 0) {
        this.failOnAttempts = failAttempts;
    }

    public async run(input: any): Promise<any> {
        this.runCount++;
        await new Promise(resolve => setTimeout(resolve, this.delayMs));
        
        if (this.runCount <= this.failOnAttempts) {
            throw new Error(`Intentional agent fail (Attempt ${this.runCount})`);
        }

        return {
            success: true,
            output: `Agent ran with delay ${this.delayMs}ms`,
            data: { 
                param: input.inputs?.param || 'default',
                runCount: this.runCount
            }
        };
    }
}

describe('Execution Engine Tests', () => {

    before(() => {
        if (!fs.existsSync(TEMP_WORKSPACE)) {
            fs.mkdirSync(TEMP_WORKSPACE, { recursive: true });
        }

        SecretManager.getInstance().initialize({
            get: async () => 'mock-key',
            store: async () => {},
            delete: async () => {}
        });
    });

    beforeEach(() => {
        AgentRegistry.getInstance().clear();
    });

    // ─── 1. Sequential & Pipeline Execution ──────────────────────────────────
    test('should execute linear step pipeline successfully', async () => {
        const engine = new ExecutionEngine(TEMP_WORKSPACE);
        // Register agent to handle steps
        AgentRegistry.getInstance().register(new DelayAgent(10));

        const result = await engine.executePipeline([
            { agentId: 'delay_agent', taskDescription: 'Step 1', inputs: { param: 'val1' } },
            { agentId: 'delay_agent', taskDescription: 'Step 2' }
        ]);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.nodes.length, 2);
        assert.strictEqual(result.nodes[0].status, 'completed');
        assert.strictEqual(result.nodes[1].status, 'completed');
    });

    // ─── 2. DAG Execution & Dependency Resolver ──────────────────────────────
    test('should execute DAG and propagate state outputs correctly', async () => {
        const engine = new ExecutionEngine(TEMP_WORKSPACE);
        AgentRegistry.getInstance().register(new DelayAgent(10));

        const graph = new ExecutionGraph();
        graph.addNode({
            id: 'A',
            agentId: 'delay_agent',
            taskDescription: 'Node A',
            dependencies: [],
            status: 'pending',
            inputs: { param: 'A_val' }
        });
        graph.addNode({
            id: 'B',
            agentId: 'delay_agent',
            taskDescription: 'Node B',
            dependencies: [],
            status: 'pending',
            inputs: { param: 'B_val' }
        });
        graph.addNode({
            id: 'C',
            agentId: 'delay_agent',
            taskDescription: 'Node C',
            dependencies: ['A', 'B'], // C A ve B'ye bağımlı
            status: 'pending'
        });

        const result = await engine.executeGraph(graph);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.nodes.find(n => n.id === 'C')?.status, 'completed');
        
        // Assert state was propagated
        const nodeC = graph.getNode('C');
        assert.ok(nodeC);
        // Outputs of A and B should be merged inside C inputs
        assert.strictEqual(nodeC.inputs?.param, 'B_val'); // overridden or merged last
    });

    // ─── 3. Parallel Execution & Concurrency ─────────────────────────────────
    test('should execute independent nodes concurrently', async () => {
        const engine = new ExecutionEngine(TEMP_WORKSPACE);
        // Eşzamanlı çalışacak iki uzun işleyici tanımla
        AgentRegistry.getInstance().register(new DelayAgent(50));

        const graph = new ExecutionGraph();
        graph.addNode({ id: 'P1', agentId: 'delay_agent', taskDescription: 'T1', dependencies: [], status: 'pending' });
        graph.addNode({ id: 'P2', agentId: 'delay_agent', taskDescription: 'T2', dependencies: [], status: 'pending' });

        const startTime = Date.now();
        const result = await engine.executeGraph(graph, { maxConcurrency: 2 });
        const duration = Date.now() - startTime;

        assert.strictEqual(result.success, true);
        // İki tane 50ms paralel çalışan düğümün toplam süresi 100ms'den daha kısa olmalıdır
        assert.ok(duration < 90, `Concurrently executed steps took longer than expected: ${duration}ms`);
        assert.ok(result.metrics.parallelismFactor > 1.0);
    });

    // ─── 4. Retry Policy Tests ───────────────────────────────────────────────
    test('should retry failed steps and eventually succeed', async () => {
        const engine = new ExecutionEngine(TEMP_WORKSPACE);
        // İlk 2 denemede hata verip 3. denemede başarılı olacak
        AgentRegistry.getInstance().register(new DelayAgent(5, 2));

        const graph = new ExecutionGraph();
        graph.addNode({ id: 'R1', agentId: 'delay_agent', taskDescription: 'Retry Task', dependencies: [], status: 'pending' });

        const result = await engine.executeGraph(graph, { maxRetries: 3 });
        assert.strictEqual(result.success, true);
        
        const node = graph.getNode('R1');
        assert.ok(node);
        assert.strictEqual(node.status, 'completed');
        assert.strictEqual(node.attempts, 2); // 2 failures, 3rd execution (retry 2) succeeds
    });

    // ─── 5. Timeout Manager Tests ────────────────────────────────────────────
    test('should timeout step and cancel downstream dependent tasks', async () => {
        const engine = new ExecutionEngine(TEMP_WORKSPACE);
        // 200ms süren yavaş bir ajan kaydet
        AgentRegistry.getInstance().register(new DelayAgent(200));

        const graph = new ExecutionGraph();
        graph.addNode({ id: 'SlowNode', agentId: 'delay_agent', taskDescription: 'Slow Task', dependencies: [], status: 'pending' });
        graph.addNode({ id: 'Downstream', agentId: 'delay_agent', taskDescription: 'Dependent Task', dependencies: ['SlowNode'], status: 'pending' });

        // TimeoutMs limitini 50ms yap
        const result = await engine.executeGraph(graph, { timeoutMs: 50 });
        
        assert.strictEqual(result.success, false);
        assert.strictEqual(graph.getNode('SlowNode')?.status, 'failed');
        assert.strictEqual(graph.getNode('Downstream')?.status, 'cancelled');
    });

    // ─── 6. EventBus and Metrics Verification ────────────────────────────────
    test('should dispatch EventBus events and persist runs on disk', async () => {
        const engine = new ExecutionEngine(TEMP_WORKSPACE);
        AgentRegistry.getInstance().register(new DelayAgent(10));

        const eventBus = EventBus.getInstance();
        const events: string[] = [];

        const unsub = [
            eventBus.on('ExecutionStarted', () => events.push('Started')),
            eventBus.on('ExecutionStepStarted', () => events.push('StepStarted')),
            eventBus.on('ExecutionStepCompleted', () => events.push('StepCompleted')),
            eventBus.on('ExecutionCompleted', () => events.push('Completed'))
        ];

        const result = await engine.execute('Görevi çalıştır'); // routes standalone task
        unsub.forEach(fn => fn());

        assert.strictEqual(result.success, true);
        assert.ok(events.includes('Started'));
        assert.ok(events.includes('StepStarted'));
        assert.ok(events.includes('StepCompleted'));
        assert.ok(events.includes('Completed'));

        // Verify disk serialization
        const runLogPath = path.join(TEMP_WORKSPACE, '.aios', 'execution', `run_${result.executionId}.json`);
        assert.ok(fs.existsSync(runLogPath));
    });
});
