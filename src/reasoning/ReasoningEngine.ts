import { ContextPackage } from '../context/types';
import { IntentClassifier } from './classifier/IntentClassifier';
import { ComplexityAnalyzer } from './analyzer/ComplexityAnalyzer';
import { StrategyEngine } from './strategy/StrategyEngine';
import { PlanningEngine } from './planner/PlanningEngine';
import { DecisionValidator } from './validator/DecisionValidator';
// Import ReasoningTraceManager from trace/ReasoningTrace
import { ReasoningTraceManager } from './trace/ReasoningTrace';
import { ReasoningCache } from './cache/ReasoningCache';
import { ReasoningMetrics } from './metrics/ReasoningMetrics';
import {
    ComplexityLevel,
    ExecutionPlan,
    ReasoningInput,
    ReasoningResult,
    ReasoningStrategy,
    ReasoningValidationResult,
    TaskIntent,
    TraceDecision
} from './shared/reasoningTypes';

export class ReasoningEngine {
    private readonly classifier = new IntentClassifier();
    private readonly complexityAnalyzer = new ComplexityAnalyzer();
    private readonly strategyEngine = new StrategyEngine();
    private readonly planner = new PlanningEngine();
    private readonly validator = new DecisionValidator();
    
    private readonly traceManager: ReasoningTraceManager;
    private readonly cache: ReasoningCache;
    private readonly metrics: ReasoningMetrics;

    constructor(workspaceRoot: string) {
        this.traceManager = new ReasoningTraceManager(workspaceRoot);
        this.cache = new ReasoningCache(workspaceRoot);
        this.metrics = new ReasoningMetrics(workspaceRoot);
    }

    /**
     * Tüm reasoning akışını çalıştırır, cache kontrolü yapar ve sonucu döndürür.
     */
    public async analyze(input: ReasoningInput): Promise<ReasoningResult> {
        const startTime = Date.now();
        const taskDescription = input.taskDescription;
        const context = input.contextPackage;
        const options = input.options || {};

        // 1. Cache Kontrolü
        const fingerprint = this.cache.generateFingerprint(taskDescription, context);
        if (!options.forceRefresh) {
            const cachedResult = this.cache.get(fingerprint);
            if (cachedResult) {
                // Metrik kaydet
                this.metrics.recordUsage({
                    id: cachedResult.id,
                    timestamp: Date.now(),
                    taskDescription,
                    reasoningTimeMs: Date.now() - startTime,
                    selectedStrategy: cachedResult.strategy,
                    complexityLevel: cachedResult.complexity,
                    estimatedSteps: cachedResult.plan.steps.length,
                    confidence: cachedResult.plan.confidence,
                    riskScore: cachedResult.plan.riskScore,
                    fromCache: true
                });
                return cachedResult;
            }
        }

        const decisions: TraceDecision[] = [];

        // 2. Intent Classification
        const classifierResult = this.classifier.classify(taskDescription, context);
        const intent = classifierResult.intent;
        decisions.push({
            stage: 'intent',
            result: intent,
            confidence: classifierResult.confidence,
            reasoning: `Matched keywords: [${classifierResult.matchedKeywords.join(', ')}]. Base text analyzed.`
        });

        // 3. Complexity Analysis
        const complexityResult = this.complexityAnalyzer.analyze(taskDescription, intent, context);
        const complexity = complexityResult.level;
        decisions.push({
            stage: 'complexity',
            result: complexity,
            score: complexityResult.score,
            reasoning: `Complexity score: ${complexityResult.score} based on text length, files (${context?.relatedFiles?.length || 0}) and intent.`
        });

        // 4. Strategy Selection
        const preferredStrategy = options.preferredStrategy || this.strategyEngine.selectStrategy(intent, complexity, context);
        const strategy = preferredStrategy;
        decisions.push({
            stage: 'strategy',
            result: strategy,
            reasoning: `Strategy selected: ${strategy} based on intent (${intent}) and complexity (${complexity}).`
        });

        // 5. Execution Planning
        const plan = this.planner.buildExecutionPlan(taskDescription, intent, complexity, strategy, context);
        decisions.push({
            stage: 'planning',
            result: plan.id,
            reasoning: `Generated plan with ${plan.steps.length} steps. Estimated effort: ${plan.estimatedEffortHours} hours.`
        });

        // 6. Plan Validation
        const validation = this.validator.validate(plan);
        decisions.push({
            stage: 'validation',
            result: validation.valid ? 'valid' : 'invalid',
            reasoning: `Validation errors: ${validation.errors.length}, warnings: ${validation.warnings.length}`
        });

        const durationMs = Date.now() - startTime;
        const reasoningId = `reasoning_${Date.now()}`;

        // 7. Trace oluştur ve kaydet
        const trace = {
            id: reasoningId,
            timestamp: Date.now(),
            inputDescription: taskDescription,
            contextCacheKey: context?.cacheKey,
            decisions,
            durationMs
        };
        this.traceManager.saveTrace(trace);

        const result: ReasoningResult = {
            id: reasoningId,
            createdAt: Date.now(),
            intent,
            intentConfidence: classifierResult.confidence,
            complexity,
            complexityScore: complexityResult.score,
            strategy,
            plan,
            trace,
            validation,
            fromCache: false,
            durationMs
        };

        // 8. Cache'e ekle
        this.cache.set(fingerprint, result);

        // 9. Metrikleri kaydet
        this.metrics.recordUsage({
            id: reasoningId,
            timestamp: Date.now(),
            taskDescription,
            reasoningTimeMs: durationMs,
            selectedStrategy: strategy,
            complexityLevel: complexity,
            estimatedSteps: plan.steps.length,
            confidence: plan.confidence,
            riskScore: plan.riskScore,
            fromCache: false
        });

        return result;
    }

    /**
     * analyze() metodu için kolaylaştırıcı sarmalayıcı (convenience wrapper).
     */
    public async reason(taskDescription: string, context?: ContextPackage): Promise<ReasoningResult> {
        return this.analyze({ taskDescription, contextPackage: context });
    }

    /**
     * Planlama mantığını doğrudan çalıştırıp sadece planı döndürür.
     */
    public async plan(input: ReasoningInput): Promise<ExecutionPlan> {
        const result = await this.analyze(input);
        return result.plan;
    }

    /**
     * Görev tipini sınıflandırır.
     */
    public classify(taskDescription: string): TaskIntent {
        return this.classifier.classify(taskDescription).intent;
    }

    /**
     * Görev zorluğunu tahmin eder.
     */
    public estimateComplexity(input: ReasoningInput): ComplexityLevel {
        const intent = this.classify(input.taskDescription);
        return this.complexityAnalyzer.analyze(input.taskDescription, intent, input.contextPackage).level;
    }

    /**
     * Strateji seçimi yapar.
     */
    public selectStrategy(intent: TaskIntent, complexity: ComplexityLevel): ReasoningStrategy {
        return this.strategyEngine.selectStrategy(intent, complexity);
    }

    /**
     * Doğrudan bir plan oluşturur (caching/tracing olmadan).
     */
    public buildExecutionPlan(input: ReasoningInput): ExecutionPlan {
        const taskDescription = input.taskDescription;
        const context = input.contextPackage;
        const intent = this.classify(taskDescription);
        const complexity = this.estimateComplexity(input);
        const strategy = this.selectStrategy(intent, complexity);
        return this.planner.buildExecutionPlan(taskDescription, intent, complexity, strategy, context);
    }

    /**
     * Planı doğrular.
     */
    public validatePlan(plan: ExecutionPlan): ReasoningValidationResult {
        return this.validator.validate(plan);
    }
}
