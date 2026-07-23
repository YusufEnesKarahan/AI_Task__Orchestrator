export type ExecutionStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ExecutionNode {
    id: string;
    agentId: string;
    taskDescription: string;
    dependencies: string[]; // Node IDs that must complete first
    status: ExecutionStepStatus;
    inputs?: Record<string, any>;
    output?: any;
    error?: string;
    durationMs?: number;
    attempts?: number;
}

export interface RetryConfig {
    maxRetries: number;
    backoffMs: number;
}

export interface TimeoutConfig {
    timeoutMs: number;
}

export interface ExecutionMetrics {
    totalDurationMs: number;
    successRate: number;        // percentage (0-100)
    parallelismFactor: number;  // (total execution time of steps) / total graph time
    stepDurations: Record<string, number>;
}

export interface ExecutionResult {
    executionId: string;
    success: boolean;
    nodes: ExecutionNode[];
    metrics: ExecutionMetrics;
    errors?: string[];
}
