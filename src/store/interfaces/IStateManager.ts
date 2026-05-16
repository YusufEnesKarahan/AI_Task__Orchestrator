import {
    ActionResult,
    AppState,
    ApprovalRequest,
    ErrorRecord,
    Project,
    PromptRun,
    SystemLog,
    Task,
    TaskStatus,
    ValidationResult
} from '../../core/types';
import { Prompt } from '../../core/types/prompt.types';

export interface IStateManager {
    init(): Promise<void>;
    getState(): Promise<AppState>;
    saveState(state?: AppState): Promise<void>;
    replaceState(state: AppState): Promise<void>;

    setProject(project: Project): Promise<void>;

    addTask(task: Task): Promise<void>;
    replaceTasks(tasks: Task[]): Promise<void>;
    updateTaskStatus(taskId: string, status: TaskStatus): Promise<void>;

    addLog(log: SystemLog): Promise<void>;
    addErrorRecord(error: ErrorRecord): Promise<void>;

    addPromptRun(run: PromptRun): Promise<void>;
    addActionResult(result: ActionResult): Promise<void>;
    addValidationResult(result: ValidationResult): Promise<void>;

    // Prompt Queue CRUD
    addPrompt(prompt: Prompt): Promise<void>;
    updatePrompt(promptId: string, updates: Partial<Prompt>): Promise<void>;
    replacePrompts(prompts: Prompt[]): Promise<void>;

    addApproval(approval: ApprovalRequest): Promise<void>;
    updateApproval(approvalId: string, status: ApprovalRequest['status']): Promise<void>;
}
