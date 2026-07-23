import { describe, test, before, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import { ReasoningEngine } from '../../src/reasoning/ReasoningEngine';
import { IntentClassifier } from '../../src/reasoning/classifier/IntentClassifier';
import { ComplexityAnalyzer } from '../../src/reasoning/analyzer/ComplexityAnalyzer';
import { StrategyEngine } from '../../src/reasoning/strategy/StrategyEngine';
import { PlanningEngine } from '../../src/reasoning/planner/PlanningEngine';
import { DecisionValidator } from '../../src/reasoning/validator/DecisionValidator';
import { ReasoningCache } from '../../src/reasoning/cache/ReasoningCache';
import { ReasoningMetrics } from '../../src/reasoning/metrics/ReasoningMetrics';
import { ContextPackage } from '../../src/context/types';

const TEMP_WORKSPACE = path.join(__dirname, '..', '..', 'scratch', 'temp_workspace_reasoning_test');

describe('Reasoning Engine Unit & Integration Tests', () => {
    
    // Set up temp workspace for reasoning state storage
    before(() => {
        if (!fs.existsSync(TEMP_WORKSPACE)) {
            fs.mkdirSync(TEMP_WORKSPACE, { recursive: true });
        }
    });

    const mockContext: ContextPackage = {
        id: 'context_123',
        createdAt: Date.now(),
        cacheKey: 'cache_key_abc',
        budget: 'medium',
        tokenBudget: 5000,
        tokenEstimate: 100,
        agent: 'planner',
        taskType: 'feature',
        priority: 'medium',
        project: { name: 'TestProj', type: 'NodeJS' },
        architecture: { type: 'Layered', confidence: 0.9 },
        memory: { currentSprint: 'sprint1', currentGoal: 'goal1', currentTask: 'task1' },
        knowledge: {
            technologies: ['TypeScript', 'NodeJS'],
            modules: ['core', 'ui'],
            knownIssues: []
        },
        relatedFiles: ['src/core/main.ts', 'src/ui/button.ts'],
        relatedModules: ['core', 'ui'],
        dependencies: [],
        knownIssues: [],
        rules: ['Rule 1: Always test code'],
        items: [],
        excludedItems: [],
        warnings: []
    };

    // ─── 1. IntentClassifier Tests ───────────────────────────────────────────
    describe('IntentClassifier', () => {
        const classifier = new IntentClassifier();

        test('should classify bug fix task correctly', () => {
            const res = classifier.classify('Düğmeye tıklanınca oluşan çökme hatasını düzelt');
            assert.strictEqual(res.intent, 'bugfix');
            assert.ok(res.confidence > 0);
        });

        test('should classify feature task correctly', () => {
            const res = classifier.classify('Kullanıcı giriş ekranına yeni bir form ekle');
            assert.strictEqual(res.intent, 'feature');
        });

        test('should classify security task correctly', () => {
            const res = classifier.classify('JWT yetkilendirme yetkilerini sanitize et ve sql injection açıklarını kapat');
            assert.strictEqual(res.intent, 'security');
        });
    });

    // ─── 2. ComplexityAnalyzer Tests ─────────────────────────────────────────
    describe('ComplexityAnalyzer', () => {
        const analyzer = new ComplexityAnalyzer();

        test('should analyze simple complexity for short task and few files', () => {
            const res = analyzer.analyze('Basit test yaz', 'test', {
                ...mockContext,
                relatedFiles: ['file1.ts']
            });
            assert.strictEqual(res.level, 'simple');
        });

        test('should analyze critical complexity for security task with low architecture confidence', () => {
            const res = analyzer.analyze(
                'Büyük sql injection ve auth açığını kapatmak için tüm veritabanı katmanını kontrol et ve doğrula, güvenlik önlemlerini en üst düzeye çıkar.',
                'security',
                {
                    ...mockContext,
                    architecture: { type: 'Microservices', confidence: 0.3 },
                    knownIssues: ['issue1', 'issue2'],
                    relatedFiles: ['f1.ts', 'f2.ts', 'f3.ts', 'f4.ts', 'f5.ts', 'f6.ts', 'f7.ts', 'f8.ts', 'f9.ts', 'f10.ts', 'f11.ts']
                }
            );
            assert.strictEqual(res.level, 'critical');
        });
    });

    // ─── 3. StrategyEngine Tests ─────────────────────────────────────────────
    describe('StrategyEngine', () => {
        const strategyEngine = new StrategyEngine();

        test('should select sequential strategy for simple bugfix', () => {
            const res = strategyEngine.selectStrategy('bugfix', 'simple');
            assert.strictEqual(res, 'sequential');
        });

        test('should select tree_of_thought for critical complexity', () => {
            const res = strategyEngine.selectStrategy('feature', 'critical');
            assert.strictEqual(res, 'tree_of_thought');
        });

        test('should select architecture_first for refactor', () => {
            const res = strategyEngine.selectStrategy('refactor', 'medium');
            assert.strictEqual(res, 'architecture_first');
        });
    });

    // ─── 4. PlanningEngine Tests ─────────────────────────────────────────────
    describe('PlanningEngine', () => {
        const planner = new PlanningEngine();

        test('should build sequential execution plan', () => {
            const plan = planner.buildExecutionPlan('Yeni alan ekle', 'feature', 'simple', 'sequential');
            assert.ok(plan.steps.length >= 3);
            assert.strictEqual(plan.steps[0].id, 'step_1_analysis');
        });

        test('should build divide and conquer plan with files', () => {
            const plan = planner.buildExecutionPlan('Karmaşık entegrasyon yap', 'feature', 'complex', 'divide_and_conquer', mockContext);
            assert.ok(plan.steps.length > 2);
            assert.ok(plan.steps.some(s => s.id.includes('subtask')));
        });
    });

    // ─── 5. DecisionValidator Tests ──────────────────────────────────────────
    describe('DecisionValidator', () => {
        const validator = new DecisionValidator();

        test('should catch empty plan errors', () => {
            const badPlan = {
                id: 'p_1',
                createdAt: Date.now(),
                strategy: 'sequential' as any,
                complexity: 'simple' as any,
                intent: 'feature' as any,
                steps: [],
                confidence: 1.0,
                riskScore: 0.0
            };
            const val = validator.validate(badPlan);
            assert.strictEqual(val.valid, false);
            assert.ok(val.errors.includes('Plan herhangi bir adım (step) içermiyor.'));
        });

        test('should catch circular dependencies', () => {
            const cyclicPlan = {
                id: 'p_2',
                createdAt: Date.now(),
                strategy: 'sequential' as any,
                complexity: 'simple' as any,
                intent: 'feature' as any,
                steps: [
                    { id: 's1', title: 'S1', description: 'd', priority: 'high' as any, dependencies: ['s2'], expectedOutput: 'o', risk: 'low' as any },
                    { id: 's2', title: 'S2', description: 'd', priority: 'high' as any, dependencies: ['s1'], expectedOutput: 'o', risk: 'low' as any }
                ],
                confidence: 1.0,
                riskScore: 0.0
            };
            const val = validator.validate(cyclicPlan);
            assert.strictEqual(val.valid, false);
            assert.ok(val.errors.some(e => e.includes('döngüsel bağımlılık')));
        });
    });

    // ─── 6. ReasoningCache Tests ─────────────────────────────────────────────
    describe('ReasoningCache', () => {
        let cache: ReasoningCache;

        beforeEach(() => {
            cache = new ReasoningCache(TEMP_WORKSPACE);
            cache.clear();
        });

        test('should cache and hit results with fingerprint', () => {
            const fingerprint = cache.generateFingerprint('Hata düzelt', mockContext);
            const dummyResult: any = { id: 'r_1', intent: 'bugfix', strategy: 'sequential', plan: { steps: [] } };
            
            cache.set(fingerprint, dummyResult);
            const hit = cache.get(fingerprint);
            
            assert.ok(hit);
            assert.strictEqual(hit.intent, 'bugfix');
            assert.strictEqual(hit.fromCache, true);
        });
    });

    // ─── 7. ReasoningMetrics Tests ───────────────────────────────────────────
    describe('ReasoningMetrics', () => {
        let metrics: ReasoningMetrics;

        beforeEach(() => {
            metrics = new ReasoningMetrics(TEMP_WORKSPACE);
            // Clear prior file if exists
            const file = path.join(TEMP_WORKSPACE, '.aios', 'reasoning', 'reasoning-metrics.json');
            if (fs.existsSync(file)) fs.unlinkSync(file);
        });

        test('should record metrics and summarize correctly', () => {
            metrics.recordUsage({
                id: 'm_1',
                timestamp: Date.now(),
                taskDescription: 'Desc 1',
                reasoningTimeMs: 150,
                selectedStrategy: 'sequential',
                complexityLevel: 'simple',
                estimatedSteps: 3,
                confidence: 0.9,
                riskScore: 0.2,
                fromCache: false
            });

            metrics.recordUsage({
                id: 'm_2',
                timestamp: Date.now(),
                taskDescription: 'Desc 2',
                reasoningTimeMs: 10,
                selectedStrategy: 'sequential',
                complexityLevel: 'simple',
                estimatedSteps: 3,
                confidence: 0.9,
                riskScore: 0.2,
                fromCache: true
            });

            const summary = metrics.getSummary();
            assert.strictEqual(summary.totalRuns, 2);
            assert.strictEqual(summary.cacheHitRate, 0.5);
            assert.strictEqual(summary.avgDurationMs, 80); // (150+10)/2
        });
    });

    // ─── 8. ReasoningEngine Integration Tests ────────────────────────────────
    describe('ReasoningEngine Facade', () => {
        let engine: ReasoningEngine;

        beforeEach(() => {
            engine = new ReasoningEngine(TEMP_WORKSPACE);
            const cacheFile = path.join(TEMP_WORKSPACE, '.aios', 'reasoning', 'reasoning-cache.json');
            if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);
        });

        test('should run full analyze flow and generate plans', async () => {
            const res = await engine.analyze({
                taskDescription: 'Büyük güvenlik açığını kapat ve veri doğrulaması ekle',
                contextPackage: {
                    ...mockContext,
                    taskType: 'security' as any, // prevent feature boost so security classification wins
                    relatedFiles: ['f1.ts', 'f2.ts', 'f3.ts', 'f4.ts', 'f5.ts', 'f6.ts']
                }
            });

            assert.ok(res.id);
            assert.strictEqual(res.intent, 'security');
            assert.strictEqual(res.complexity, 'complex');
            assert.strictEqual(res.validation.valid, true);
            assert.ok(res.plan.steps.length > 0);
            assert.strictEqual(res.fromCache, false);

            // Double check execution-plans.json was updated
            const plansFile = path.join(TEMP_WORKSPACE, '.aios', 'reasoning', 'execution-plans.json');
            assert.ok(fs.existsSync(plansFile));
            const plans = JSON.parse(fs.readFileSync(plansFile, 'utf-8'));
            assert.ok(plans.length > 0);
        });
    });
});
