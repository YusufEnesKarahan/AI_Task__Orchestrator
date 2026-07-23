import { describe, test, before } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import { AIOSApplication } from '../../src/runtime/AIOSApplication';
import { DependencyContainer } from '../../src/runtime/core/DependencyContainer';
import { LifecycleManager } from '../../src/runtime/core/LifecycleManager';
import { Logger } from '../../src/runtime/core/Logger';
import { ConfigurationManager } from '../../src/runtime/core/ConfigurationManager';
import { StartupValidator } from '../../src/runtime/core/StartupValidator';
import { Bootstrapper } from '../../src/runtime/core/Bootstrapper';
import { EventBus } from '../../src/shared/events/EventBus';

const TEMP_WORKSPACE = path.join(__dirname, '..', '..', 'scratch', 'temp_workspace_runtime_test');

describe('Bootstrap & Runtime Tests', () => {

    before(() => {
        if (!fs.existsSync(TEMP_WORKSPACE)) {
            fs.mkdirSync(TEMP_WORKSPACE, { recursive: true });
        }
    });

    // ─── 1. Bootstrap Sequence ───────────────────────────────────────────────
    test('should execute bootstrap steps in correct order', async () => {
        const logger = new Logger(undefined, 'error');
        const configManager = new ConfigurationManager(TEMP_WORKSPACE);
        const container = new DependencyContainer();
        const eventBus = EventBus.getInstance();

        const bootstrapper = new Bootstrapper(logger, configManager, container, eventBus);
        assert.ok(bootstrapper.getStepCount() >= 4);

        const durationMs = await bootstrapper.run();
        assert.ok(durationMs >= 0);
        assert.strictEqual(bootstrapper.getCompletedSteps(), bootstrapper.getStepCount());

        // Container should have registered engines
        assert.ok(container.registeredCount >= 6);
    });

    // ─── 2. Configuration Loading ────────────────────────────────────────────
    test('should load default and file-based configuration', () => {
        const configManager = new ConfigurationManager(TEMP_WORKSPACE);
        const config = configManager.load();

        assert.strictEqual(config.provider, 'mock');
        assert.strictEqual(config.maxIterations, 5);
        assert.strictEqual(config.workspaceRoot, TEMP_WORKSPACE);
        assert.ok(configManager.validate());

        // Write a custom config file
        const customConfigPath = path.join(TEMP_WORKSPACE, 'aios.config.json');
        fs.writeFileSync(customConfigPath, JSON.stringify({ provider: 'gemini', maxIterations: 10 }), 'utf-8');

        const reloaded = configManager.reload();
        assert.strictEqual(reloaded.provider, 'gemini');
        assert.strictEqual(reloaded.maxIterations, 10);

        // Cleanup
        try { fs.unlinkSync(customConfigPath); } catch { /* ignore */ }
    });

    // ─── 3. Dependency Resolution ────────────────────────────────────────────
    test('should register, resolve singletons and throw on unknown services', () => {
        const container = new DependencyContainer();

        // Register a transient factory
        let callCount = 0;
        container.register('TransientService', () => {
            callCount++;
            return { id: callCount };
        });

        const t1 = container.resolve<{ id: number }>('TransientService');
        const t2 = container.resolve<{ id: number }>('TransientService');
        assert.notStrictEqual(t1.id, t2.id); // Different instances

        // Register a singleton factory
        container.singleton('SingletonService', () => ({ created: Date.now() }));
        const s1 = container.resolve<{ created: number }>('SingletonService');
        const s2 = container.resolve<{ created: number }>('SingletonService');
        assert.strictEqual(s1.created, s2.created); // Same instance

        // Unknown service should throw
        assert.throws(() => container.resolve('UnknownService'), /kayıtlı değil/);

        // has() checks
        assert.strictEqual(container.has('SingletonService'), true);
        assert.strictEqual(container.has('NonExistent'), false);
    });

    // ─── 4. Lifecycle Ordering ───────────────────────────────────────────────
    test('should run lifecycle phases in correct order', async () => {
        const logger = new Logger(undefined, 'error');
        const lcm = new LifecycleManager(logger);
        const order: string[] = [];

        lcm.addHook('EngineA', 'initialize', async () => { order.push('init-A'); });
        lcm.addHook('EngineB', 'start', async () => { order.push('start-B'); });
        lcm.addHook('EngineC', 'ready', async () => { order.push('ready-C'); });
        lcm.addHook('EngineD', 'stop', async () => { order.push('stop-D'); });
        lcm.addHook('EngineE', 'dispose', async () => { order.push('dispose-E'); });

        await lcm.startup();
        assert.deepStrictEqual(order, ['init-A', 'start-B', 'ready-C']);

        await lcm.shutdown();
        assert.deepStrictEqual(order, ['init-A', 'start-B', 'ready-C', 'stop-D', 'dispose-E']);

        const phases = lcm.getCompletedPhases();
        assert.deepStrictEqual(phases, ['initialize', 'start', 'ready', 'stop', 'dispose']);
    });

    // ─── 5. Startup Validation ───────────────────────────────────────────────
    test('should pass default checks and fail on custom failing check', () => {
        const logger = new Logger(undefined, 'error');
        const configManager = new ConfigurationManager(TEMP_WORKSPACE);
        configManager.load();

        const validator = new StartupValidator(logger, configManager);

        // Default checks should pass
        const result1 = validator.validate();
        assert.strictEqual(result1.passed, true);

        // Add a failing check
        validator.addCheck('AlwaysFails', () => false);
        const result2 = validator.validate();
        assert.strictEqual(result2.passed, false);
        assert.ok(result2.results.find(r => r.name === 'AlwaysFails' && !r.ok));
    });

    // ─── 6. Runtime Start & Shutdown ─────────────────────────────────────────
    test('should start and stop AIOSApplication lifecycle', async () => {
        const app = AIOSApplication.create(TEMP_WORKSPACE);
        assert.strictEqual(app.status(), 'idle');

        const ok = await app.start();
        assert.strictEqual(ok, true);
        assert.strictEqual(app.status(), 'ready');

        // Context should be available
        const ctx = app.getContext();
        assert.ok(ctx);
        assert.ok(ctx!.eventBus);
        assert.ok(ctx!.container);

        // Container should have engines
        assert.ok(app.getContainer().registeredCount >= 6);

        await app.stop();
        assert.strictEqual(app.status(), 'stopped');
    });

    // ─── 7. EventBus Integration ─────────────────────────────────────────────
    test('should publish runtime lifecycle events via EventBus', async () => {
        const eventBus = EventBus.getInstance();
        const events: string[] = [];

        const unsub = [
            eventBus.on('RuntimeStarting', () => events.push('Starting')),
            eventBus.on('RuntimeReady', () => events.push('Ready')),
            eventBus.on('ConfigurationLoaded', () => events.push('ConfigLoaded')),
            eventBus.on('ContainerReady', () => events.push('ContainerReady')),
            eventBus.on('BootstrapCompleted', () => events.push('BootstrapDone')),
            eventBus.on('RuntimeStopping', () => events.push('Stopping')),
            eventBus.on('RuntimeStopped', () => events.push('Stopped'))
        ];

        const app = AIOSApplication.create(TEMP_WORKSPACE);
        await app.start();
        await app.stop();

        unsub.forEach(fn => fn());

        assert.ok(events.includes('Starting'));
        assert.ok(events.includes('ConfigLoaded'));
        assert.ok(events.includes('ContainerReady'));
        assert.ok(events.includes('BootstrapDone'));
        assert.ok(events.includes('Ready'));
        assert.ok(events.includes('Stopping'));
        assert.ok(events.includes('Stopped'));
    });
});
