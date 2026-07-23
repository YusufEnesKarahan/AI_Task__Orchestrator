import { describe, test, before, beforeEach, after } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import { SystemEngine } from '../../src/system/SystemEngine';
import { EventBus } from '../../src/shared/events/EventBus';

const TEMP_WORKSPACE = path.join(__dirname, '..', '..', 'scratch', 'temp_workspace_system_test');

describe('Production Hardening Tests', () => {
    let engine: SystemEngine;

    before(() => {
        if (!fs.existsSync(TEMP_WORKSPACE)) {
            fs.mkdirSync(TEMP_WORKSPACE, { recursive: true });
        }
        engine = new SystemEngine(TEMP_WORKSPACE);
    });

    beforeEach(() => {
        // Clear metrics files
        const sysDir = path.join(TEMP_WORKSPACE, '.aios', 'system');
        if (fs.existsSync(sysDir)) {
            const files = fs.readdirSync(sysDir);
            for (const file of files) {
                try {
                    fs.unlinkSync(path.join(sysDir, file));
                } catch {
                    // Windows resource locks
                }
            }
        }
        engine.getCacheManager().clear();
    });

    after(() => {
        engine.getTelemetryManager().dispose();
    });

    // ─── 1. System Profiling ─────────────────────────────────────────────────
    test('should profile running times and detect slowest pipelines', async () => {
        const profiler = engine.getProfiler();
        
        profiler.startMeasure('WorkflowPipeline');
        await new Promise(resolve => setTimeout(resolve, 30));
        profiler.stopMeasure('WorkflowPipeline');

        profiler.startMeasure('ReviewPipeline');
        await new Promise(resolve => setTimeout(resolve, 10));
        profiler.stopMeasure('ReviewPipeline');

        const report = engine.profile();
        assert.ok(report.durations['WorkflowPipeline'] >= 30);
        assert.ok(report.durations['ReviewPipeline'] >= 10);
        
        // WorkflowPipeline should be the slowest
        assert.strictEqual(report.slowestPipelines[0], 'WorkflowPipeline');
        assert.ok(report.averageExecutionTime > 15);
    });

    // ─── 2. Memory Analysis ──────────────────────────────────────────────────
    test('should extract process memory usages and warnings', () => {
        const memory = engine.checkMemory();
        assert.ok(memory.heapUsed > 0);
        assert.ok(memory.heapTotal > 0);
        assert.ok(memory.rss > 0);
        // Leak warnings should resolve as boolean
        assert.strictEqual(typeof memory.leakWarning, 'boolean');
    });

    // ─── 3. Caching Layer ────────────────────────────────────────────────────
    test('should store, fetch, and invalidate in-memory caches', () => {
        const cache = engine.getCacheManager();
        
        cache.set('mcp', 'tool-1', { name: 'tool-1' });
        const val = cache.get('mcp', 'tool-1');
        assert.deepStrictEqual(val, { name: 'tool-1' });

        cache.clear('mcp');
        assert.strictEqual(cache.get('mcp', 'tool-1'), undefined);
    });

    // ─── 4. Health Checks ────────────────────────────────────────────────────
    test('should query health monitors for registries and connections', async () => {
        const health = await engine.checkHealth();
        assert.strictEqual(typeof health.status, 'string');
        assert.ok(health.details.agentRegistry !== undefined);
        assert.ok(health.details.gitConnection !== undefined);
    });

    // ─── 5. Recovery Manager ─────────────────────────────────────────────────
    test('should scan and recover workspace state logs', async () => {
        // Write dummy JSON inside .aios/workflow directory
        const wfDir = path.join(TEMP_WORKSPACE, '.aios', 'workflow');
        if (!fs.existsSync(wfDir)) {
            fs.mkdirSync(wfDir, { recursive: true });
        }
        const dummyFile = path.join(wfDir, 'wf_dummy.json');
        fs.writeFileSync(dummyFile, JSON.stringify({ id: 'dummy' }), 'utf-8');

        const report = await engine.recover('all');
        assert.strictEqual(report.success, true);
        assert.ok(report.restoredCount >= 1);

        try {
            fs.unlinkSync(dummyFile);
        } catch {
            // ignore
        }
    });

    // ─── 6. Benchmark Runner ─────────────────────────────────────────────────
    test('should execute CPU loads and compute operations count', async () => {
        const result = await engine.benchmark('large_repository');
        assert.strictEqual(result.benchmarkName, 'large_repository');
        assert.ok(result.durationMs >= 0);
        assert.ok(result.opsPerSec > 0);
    });

    // ─── 7. Telemetry & EventBus ─────────────────────────────────────────────
    test('should subscribe to telemetry indicators and publish EventBus notifications', async () => {
        const eventBus = EventBus.getInstance();
        const events: string[] = [];

        const unsub = [
            eventBus.on('SystemHealthChecked', () => events.push('Health')),
            eventBus.on('BenchmarkCompleted', () => events.push('Benchmark')),
            eventBus.on('RecoveryCompleted', () => events.push('Recovery')),
            eventBus.on('ProfilingCompleted', () => events.push('Profile')),
            eventBus.on('CacheUpdated', () => events.push('Cache'))
        ];

        // Trigger Cache write
        engine.getCacheManager().set('git', 'key', 'val');
        
        // Trigger Profile report
        engine.profile();

        // Trigger Health check
        await engine.checkHealth();

        // Trigger Recovery
        await engine.recover('test');

        // Trigger Benchmark
        await engine.benchmark('test');

        unsub.forEach(fn => fn());

        assert.ok(events.includes('Cache'));
        assert.ok(events.includes('Profile'));
        assert.ok(events.includes('Health'));
        assert.ok(events.includes('Recovery'));
        assert.ok(events.includes('Benchmark'));

        // Verify metrics
        const metrics = engine.getMetrics();
        assert.ok(metrics.totalProfilesRun >= 1);
        assert.ok(metrics.totalBenchmarksRun >= 1);
    });
});
