export interface LoopState {
    runId: string;
    taskId: string;
    status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
    iteration: number;
    maxIterations: number;
    currentWorkflowId?: string;
    score?: number;
    errors: string[];
}

export interface LoopHistory {
    runId: string;
    taskId: string;
    startedAt: number;
    completedAt?: number;
    iterationsCount: number;
    finalScore?: number;
    status: 'completed' | 'failed' | 'cancelled';
    errors: string[];
}

export interface LoopMetrics {
    totalLoops: number;
    successfulLoops: number;
    failedLoops: number;
    totalIterationsRun: number;
    averageIterationsPerLoop: number;
}
