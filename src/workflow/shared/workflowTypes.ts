export interface WorkflowStep {
    name: string;
    type: 'execution' | 'action' | 'review';
    payload: any; // E.g., agent pipeline steps, actions definitions, or list of reviewers
    if?: (state: WorkflowState) => boolean;
    failurePolicy?: 'retry' | 'rollback' | 'ignore';
    maxRetries?: number;
}

export interface WorkflowDefinition {
    name: string;
    description: string;
    steps: WorkflowStep[];
}

export interface WorkflowState {
    workflowId: string;
    templateName: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    currentStepIndex: number;
    stepResults: Record<string, any>; // maps step name to its result
    variables: Record<string, any>; // shared memory payload between steps
}

export interface WorkflowRunLog {
    workflowId: string;
    templateName: string;
    success: boolean;
    startedAt: number;
    completedAt?: number;
    durationMs?: number;
    state: WorkflowState;
}

export interface WorkflowMetrics {
    totalWorkflows: number;
    passedCount: number;
    failedCount: number;
    averageDurationMs: number;
}
