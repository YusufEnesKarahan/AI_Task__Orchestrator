import { describe, test, before, beforeEach, after } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import { AutonomousEngine } from '../../src/autonomous/AutonomousEngine';
import { ReviewRegistry } from '../../src/review/core/ReviewRegistry';
import { IReviewer } from '../../src/review/core/IReviewer';
import { ReviewContext, ReviewerResult } from '../../src/review/shared/reviewTypes';
import { EventBus } from '../../src/shared/events/EventBus';

const TEMP_WORKSPACE = path.join(__dirname, '..', '..', 'scratch', 'temp_workspace_autonomous_test');

describe('Autonomous Development Loop Tests', () => {
    let engine: AutonomousEngine;
    const originalReviewers: IReviewer[] = [];

    before(() => {
        if (!fs.existsSync(TEMP_WORKSPACE)) {
            fs.mkdirSync(TEMP_WORKSPACE, { recursive: true });
        }
        engine = new AutonomousEngine(TEMP_WORKSPACE, 3);

        const registry = ReviewRegistry.getInstance();
        originalReviewers.push(...registry.getAllReviewers());
    });

    beforeEach(() => {
        const autDir = path.join(TEMP_WORKSPACE, '.aios', 'autonomous');
        if (fs.existsSync(autDir)) {
            const files = fs.readdirSync(autDir);
            for (const file of files) {
                try {
                    fs.unlinkSync(path.join(autDir, file));
                } catch {
                    // Windows resource locks
                }
            }
        }
    });

    after(() => {
        const registry = ReviewRegistry.getInstance();
        registry.clear();
        for (const rev of originalReviewers) {
            registry.register(rev);
        }
    });

    // ─── 1. Successful Development Loop ──────────────────────────────────────
    test('should complete in 1 iteration when review score is high', async () => {
        const registry = ReviewRegistry.getInstance();
        registry.clear();
        
        registry.register({
            name: 'MockReviewer',
            review: async (context: ReviewContext): Promise<ReviewerResult> => {
                return {
                    reviewerName: 'MockReviewer',
                    passed: true,
                    issues: [],
                    warnings: [],
                    score: 95
                };
            }
        });

        const success = await engine.run({
            id: 'task-1',
            title: 'Fix issue',
            description: '',
            category: 'bug',
            sourceType: 'json',
            priority: 'high',
            status: 'pending',
            dependencies: []
        });

        assert.strictEqual(success, true);
        const history = engine.getHistory();
        assert.strictEqual(history.length, 1);
        assert.strictEqual(history[0].iterationsCount, 1);
        assert.strictEqual(history[0].status, 'completed');
    });

    // ─── 2. Retry After Failed Review ────────────────────────────────────────
    test('should retry when review fails initially and complete when it passes', async () => {
        const registry = ReviewRegistry.getInstance();
        registry.clear();

        let callCount = 0;
        registry.register({
            name: 'MockReviewer',
            review: async (context: ReviewContext): Promise<ReviewerResult> => {
                callCount++;
                if (callCount === 1) {
                    return {
                        reviewerName: 'MockReviewer',
                        passed: false,
                        issues: ['High complexity detected'],
                        warnings: [],
                        score: 50
                    };
                }
                return {
                    reviewerName: 'MockReviewer',
                    passed: true,
                    issues: [],
                    warnings: [],
                    score: 90
                };
            }
        });

        const success = await engine.run({
            id: 'task-2',
            title: 'Refactor code',
            description: '',
            category: 'refactor',
            sourceType: 'json',
            priority: 'medium',
            status: 'pending',
            dependencies: []
        });

        assert.strictEqual(success, true);
        assert.strictEqual(callCount, 2);

        const history = engine.getHistory();
        assert.strictEqual(history[0].iterationsCount, 2);
        assert.strictEqual(history[0].status, 'completed');
    });

    // ─── 3. Maximum Retry Limit ──────────────────────────────────────────────
    test('should fail when max iterations reached without passing review', async () => {
        const registry = ReviewRegistry.getInstance();
        registry.clear();

        let callCount = 0;
        registry.register({
            name: 'MockReviewer',
            review: async (context: ReviewContext): Promise<ReviewerResult> => {
                callCount++;
                return {
                    reviewerName: 'MockReviewer',
                    passed: false,
                    issues: ['Structural architecture leak'],
                    warnings: [],
                    score: 45
                };
            }
        });

        const success = await engine.run({
            id: 'task-3',
            title: 'Deploy microservice',
            description: '',
            category: 'feature',
            sourceType: 'json',
            priority: 'high',
            status: 'pending',
            dependencies: []
        });

        assert.strictEqual(success, false);
        assert.strictEqual(callCount, 3); // Max iterations limit = 3

        const history = engine.getHistory();
        assert.strictEqual(history[0].status, 'failed');
    });

    // ─── 4. EventBus Integration ─────────────────────────────────────────────
    test('should dispatch EventBus lifecycle events', async () => {
        const registry = ReviewRegistry.getInstance();
        registry.clear();
        registry.register({
            name: 'MockReviewer',
            review: async (): Promise<ReviewerResult> => ({
                reviewerName: 'MockReviewer',
                passed: true,
                issues: [],
                warnings: [],
                score: 85
            })
        });

        const eventBus = EventBus.getInstance();
        const events: string[] = [];

        const unsub = [
            eventBus.on('DevelopmentStarted', () => events.push('Start')),
            eventBus.on('DevelopmentIterationStarted', () => events.push('IterStart')),
            eventBus.on('DevelopmentIterationCompleted', () => events.push('IterComp')),
            eventBus.on('DevelopmentCompleted', () => events.push('Comp'))
        ];

        await engine.run({
            id: 'task-event',
            title: 'Test EventBus',
            description: '',
            category: 'docs',
            sourceType: 'json',
            priority: 'medium',
            status: 'pending',
            dependencies: []
        });

        unsub.forEach(fn => fn());

        assert.ok(events.includes('Start'));
        assert.ok(events.includes('IterStart'));
        assert.ok(events.includes('IterComp'));
        assert.ok(events.includes('Comp'));

        const metrics = engine.getMetrics();
        assert.ok(metrics.totalLoops > 0);
    });
});
