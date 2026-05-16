import Module = require('module');
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
} from '../src/core/types';
import { Prompt } from '../src/core/types/prompt.types';
import { IStateManager } from '../src/store/interfaces/IStateManager';

export function createEmptyState(overrides: Partial<AppState> = {}): AppState {
    return {
        currentProject: undefined,
        tasks: [],
        steps: [],
        approvals: [],
        prompts: [],
        promptHistory: [],
        actionHistory: [],
        validations: [],
        logs: [],
        errorRecords: [],
        ...overrides
    };
}

export function createTask(id: string, order = 0): Task {
    const now = Date.now();
    return {
        id,
        projectId: 'project_1',
        title: `Task ${id}`,
        description: `Description ${id}`,
        order,
        status: 'pending',
        type: 'code_generation',
        priority: 'medium',
        dependencies: [],
        expectedOutput: `Output ${id}`,
        createdAt: now,
        updatedAt: now
    };
}

export function createPromptForTask(taskId: string, id = `prompt_${taskId}`): Prompt {
    const now = Date.now();
    return {
        id,
        taskId,
        title: `Prompt ${taskId}`,
        systemPrompt: 'System prompt',
        content: 'User prompt',
        status: 'draft',
        executionMode: 'internal_ai',
        order: 0,
        createdAt: now,
        updatedAt: now
    };
}

export class MemoryStateManager implements IStateManager {
    private state: AppState;

    constructor(initialState: Partial<AppState> = {}) {
        this.state = createEmptyState(initialState);
    }

    public async init(): Promise<void> {}

    public async getState(): Promise<AppState> {
        return JSON.parse(JSON.stringify(this.state)) as AppState;
    }

    public async saveState(state?: AppState): Promise<void> {
        if (state) {
            this.state = createEmptyState(state);
        }
    }

    public async replaceState(state: AppState): Promise<void> {
        await this.saveState(state);
    }

    public async setProject(project: Project): Promise<void> {
        this.state.currentProject = project;
    }

    public async addTask(task: Task): Promise<void> {
        this.state.tasks.push(task);
    }

    public async replaceTasks(tasks: Task[]): Promise<void> {
        this.state.tasks = [...tasks];
    }

    public async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
        const task = this.state.tasks.find(item => item.id === taskId);
        if (task) {
            task.status = status;
            task.updatedAt = Date.now();
        }
    }

    public async addLog(log: SystemLog): Promise<void> {
        this.state.logs.push(log);
    }

    public async addErrorRecord(error: ErrorRecord): Promise<void> {
        this.state.errorRecords.push(error);
    }

    public async addPromptRun(run: PromptRun): Promise<void> {
        this.state.promptHistory.push(run);
    }

    public async addActionResult(result: ActionResult): Promise<void> {
        this.state.actionHistory.push(result);
    }

    public async addValidationResult(result: ValidationResult): Promise<void> {
        this.state.validations = this.state.validations.filter(item => item.taskId !== result.taskId);
        this.state.validations.push(result);
    }

    public async addPrompt(prompt: Prompt): Promise<void> {
        this.state.prompts.push(prompt);
    }

    public async updatePrompt(promptId: string, updates: Partial<Prompt>): Promise<void> {
        const prompt = this.state.prompts.find(item => item.id === promptId);
        if (prompt) {
            Object.assign(prompt, updates, { updatedAt: Date.now() });
        }
    }

    public async replacePrompts(prompts: Prompt[]): Promise<void> {
        this.state.prompts = [...prompts];
    }

    public async addApproval(approval: ApprovalRequest): Promise<void> {
        this.state.approvals.push(approval);
    }

    public async updateApproval(approvalId: string, status: ApprovalRequest['status']): Promise<void> {
        const approval = this.state.approvals.find(item => item.id === approvalId);
        if (approval) {
            approval.status = status;
            approval.respondedAt = Date.now();
        }
    }
}

export function installVscodeMock(): void {
    const moduleWithLoad = Module as typeof Module & {
        _load?: (request: string, parent: NodeModule | null, isMain: boolean) => unknown;
    };
    const originalLoad = moduleWithLoad._load;

    if (!originalLoad || (installVscodeMock as { installed?: boolean }).installed) {
        return;
    }

    moduleWithLoad._load = function loadWithVscodeMock(
        request: string,
        parent: NodeModule | null,
        isMain: boolean
    ): unknown {
        if (request === 'vscode') {
            return {
                workspace: {
                    findFiles: async () => [],
                    openTextDocument: async () => ({})
                },
                window: {
                    showTextDocument: async () => undefined
                },
                Uri: {
                    file: (fsPath: string) => ({ fsPath })
                }
            };
        }

        return originalLoad.call(this, request, parent, isMain);
    };

    (installVscodeMock as { installed?: boolean }).installed = true;
}
