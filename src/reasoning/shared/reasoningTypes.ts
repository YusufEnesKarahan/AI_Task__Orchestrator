import { ContextPackage } from '../../context/types';

// ─── Intent ────────────────────────────────────────────────────────────────────

export type TaskIntent =
    | 'feature'
    | 'bugfix'
    | 'refactor'
    | 'review'
    | 'documentation'
    | 'analysis'
    | 'test'
    | 'performance'
    | 'security'
    | 'architecture'
    | 'unknown';

// ─── Complexity ─────────────────────────────────────────────────────────────────

export type ComplexityLevel = 'simple' | 'medium' | 'complex' | 'critical';

// ─── Strategy ───────────────────────────────────────────────────────────────────

export type ReasoningStrategy =
    | 'sequential'
    | 'divide_and_conquer'
    | 'tree_of_thought'
    | 'review_first'
    | 'architecture_first'
    | 'memory_first'
    | 'rule_based';

// ─── Execution Plan ──────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type StepPriority = 'high' | 'medium' | 'low';

export interface ExecutionStep {
    id: string;
    title: string;
    description: string;
    priority: StepPriority;
    dependencies: string[]; // Step IDs
    expectedOutput: string;
    risk: RiskLevel;
}

export interface ExecutionPlan {
    id: string;
    createdAt: number;
    strategy: ReasoningStrategy;
    complexity: ComplexityLevel;
    intent: TaskIntent;
    steps: ExecutionStep[];
    confidence: number;    // 0-1
    riskScore: number;     // 0-1, higher = riskier
    estimatedEffortHours?: number;
}

// ─── Reasoning Trace ────────────────────────────────────────────────────────────

export interface TraceDecision {
    stage: 'intent' | 'complexity' | 'strategy' | 'planning' | 'validation';
    result: string;
    confidence?: number;
    score?: number;
    reasoning: string;
    alternatives?: string[];
}

export interface ReasoningTrace {
    id: string;
    timestamp: number;
    inputDescription: string;
    contextCacheKey?: string;
    decisions: TraceDecision[];
    durationMs: number;
}

// ─── Reasoning Result ────────────────────────────────────────────────────────────

export interface ReasoningValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export interface ReasoningResult {
    id: string;
    createdAt: number;
    intent: TaskIntent;
    intentConfidence: number;
    complexity: ComplexityLevel;
    complexityScore: number;
    strategy: ReasoningStrategy;
    plan: ExecutionPlan;
    trace: ReasoningTrace;
    validation: ReasoningValidationResult;
    fromCache: boolean;
    durationMs: number;
}

// ─── Reasoning Input ────────────────────────────────────────────────────────────

export interface ReasoningOptions {
    forceRefresh?: boolean;
    maxSteps?: number;
    preferredStrategy?: ReasoningStrategy;
}

export interface ReasoningInput {
    taskDescription: string;
    contextPackage?: ContextPackage;
    options?: ReasoningOptions;
}

// ─── Reasoning Cache ────────────────────────────────────────────────────────────

export interface ReasoningCacheEntry {
    fingerprint: string;
    createdAt: number;
    result: ReasoningResult;
}

export interface ReasoningCacheDocument {
    schemaVersion: number;
    updatedAt: number;
    entries: ReasoningCacheEntry[];
}

// ─── Reasoning Metrics ──────────────────────────────────────────────────────────

export interface ReasoningMetricRecord {
    id: string;
    timestamp: number;
    taskDescription: string;
    reasoningTimeMs: number;
    selectedStrategy: ReasoningStrategy;
    complexityLevel: ComplexityLevel;
    estimatedSteps: number;
    confidence: number;
    riskScore: number;
    fromCache: boolean;
}
