export type EntityId = string;
export type Timestamp = number;

// Prompt entity ve ilgili tipler ayrı dosyada tanımlı, buradan re-export ediliyor.
export {
    Prompt,
    PromptStatus,
    PromptExecutionMode,
    CreatePromptInput,
    createPrompt,
    isValidTransition
} from './prompt.types';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'error';
export type StepStatus = TaskStatus;
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ActionType =
    | 'read_file'
    | 'write_file'
    | 'append_file'
    | 'open_file'
    | 'list_files'
    | 'search_in_project'
    | 'run_terminal_command'
    | 'apply_diff'
    | 'create_file'
    | 'delete_file';
export type TaskType = 'code_generation' | 'refactor' | 'bug_fix' | 'test_generation' | 'documentation' | 'code_review';
export type TaskPriority = 'high' | 'medium' | 'low';
export type ApprovalSeverity = 'low' | 'medium' | 'high';
export type LogLevel = 'info' | 'warn' | 'error' | 'success';
export type ValidationStatus = 'success' | 'failed' | 'skipped' | 'not_applicable';

// Backward-compatible alias used by the current codebase.
export type Status = TaskStatus;

export interface Project {
    id: EntityId;
    title: string;
    description: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface Task {
    id: EntityId;
    projectId: EntityId;
    title: string;
    description: string;
    order: number;
    status: TaskStatus;
    type?: TaskType;
    priority?: TaskPriority;
    dependencies?: EntityId[];
    expectedOutput?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface Step {
    id: EntityId;
    taskId: EntityId;
    description: string;
    order: number;
    status: StepStatus;
    actionRequest?: ActionRequest;
}

export interface PromptTemplate {
    id: EntityId;
    name: string;
    systemPrompt: string;
    userPromptTemplate: string;
}

export interface PromptRun {
    id: EntityId;
    taskId: EntityId;
    promptTemplateId?: EntityId;
    requestPayload: string;
    responsePayload?: string;
    createdAt: Timestamp;
}

export interface ActionRequest {
    id: EntityId;
    type: ActionType;
    payload: Record<string, any>;
}

export interface ActionResult {
    actionId: EntityId;
    success: boolean;
    output?: string;
    executedAt: Timestamp;
}

export interface ApprovalRequest {
    id: EntityId;
    actionId: EntityId;
    taskId: EntityId;
    status: ApprovalStatus;
    reason: string;
    severity: ApprovalSeverity;
    actionType?: ActionType;
    actionSummary?: string;
    riskTags?: string[];
    requestedAt: Timestamp;
    respondedAt?: Timestamp;
}

export interface ValidationResult {
    taskId: EntityId;
    status: ValidationStatus;
    summary: string;
    errors?: string[];
    ruleResults: ValidationRuleResult[];
    validatedAt: Timestamp;
}

export interface ValidationRuleResult {
    ruleType: string;
    status: ValidationStatus;
    message?: string;
    target?: string;
}

export interface ErrorRecord {
    id: EntityId;
    source: string;
    message: string;
    details?: string;
    relatedEntityId?: EntityId;
    timestamp: Timestamp;
}

export interface SystemLog {
    id: EntityId;
    level: LogLevel;
    message: string;
    timestamp: Timestamp;
}

export interface AppState {
    currentProject?: Project;
    tasks: Task[];
    steps: Step[];
    approvals: ApprovalRequest[];
    prompts: import('./prompt.types').Prompt[]; // Yeni: Prompt Queue varlıkları
    promptHistory: PromptRun[]; // Eski: Log kayıtları (geriye uyumluluk)
    actionHistory: ActionResult[];
    validations: ValidationResult[];
    logs: SystemLog[];
    errorRecords: ErrorRecord[];
}
