import * as fs from 'fs/promises';
import * as path from 'path';
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
} from '../core/types';
import { Prompt } from '../core/types/prompt.types';
import { IStateManager } from './interfaces/IStateManager';

export interface JsonStateManagerOptions {
    fileName?: string;
}

const DEFAULT_STATE_FILE = 'ai-orchestrator-state.json';

function createEmptyState(): AppState {
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
        errorRecords: []
    };
}

export class JsonStateManager implements IStateManager {
    private readonly stateFilePath: string;
    private state: AppState = createEmptyState();

    constructor(workspaceRoot: string, options: JsonStateManagerOptions = {}) {
        const vscodeDir = path.join(workspaceRoot, '.vscode');
        this.stateFilePath = path.join(vscodeDir, options.fileName || DEFAULT_STATE_FILE);
    }

    public async init(): Promise<void> {
        try {
            await fs.mkdir(path.dirname(this.stateFilePath), { recursive: true });
            const data = await fs.readFile(this.stateFilePath, 'utf8');
            this.state = this.mergeWithDefaults(JSON.parse(data));
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                this.state = createEmptyState();
                await this.saveState();
                return;
            }

            this.state = createEmptyState();
            await this.addErrorRecord({
                id: `error_${Date.now()}`,
                source: 'JsonStateManager.init',
                message: 'State file could not be read. Empty state was restored.',
                details: error instanceof Error ? error.message : String(error),
                timestamp: Date.now()
            });
        }
    }

    public async getState(): Promise<AppState> {
        return this.clone(this.state);
    }

    public async saveState(state?: AppState): Promise<void> {
        if (state) {
            this.state = this.mergeWithDefaults(state);
        }

        const tempPath = `${this.stateFilePath}.tmp`;
        const serialized = JSON.stringify(this.state, null, 2);

        await fs.writeFile(tempPath, serialized, 'utf8');
        await fs.rename(tempPath, this.stateFilePath);
    }

    public async replaceState(state: AppState): Promise<void> {
        await this.saveState(state);
    }

    public async setProject(project: Project): Promise<void> {
        this.state.currentProject = project;
        await this.saveState();
    }

    public async addTask(task: Task): Promise<void> {
        this.state.tasks.push(task);
        await this.saveState();
    }

    public async replaceTasks(tasks: Task[]): Promise<void> {
        this.state.tasks = [...tasks];
        this.state.prompts = this.state.prompts.filter(prompt =>
            tasks.some(task => task.id === prompt.taskId)
        );
        this.state.approvals = this.state.approvals.filter(approval =>
            tasks.some(task => task.id === approval.taskId)
        );
        this.state.promptHistory = this.state.promptHistory.filter(run =>
            tasks.some(task => task.id === run.taskId)
        );
        this.state.validations = this.state.validations.filter(result =>
            tasks.some(task => task.id === result.taskId)
        );
        await this.saveState();
    }

    public async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
        const task = this.state.tasks.find(item => item.id === taskId);

        if (!task) {
            await this.addErrorRecord({
                id: `error_${Date.now()}`,
                source: 'JsonStateManager.updateTaskStatus',
                message: `Task not found: ${taskId}`,
                relatedEntityId: taskId,
                timestamp: Date.now()
            });
            return;
        }

        task.status = status;
        task.updatedAt = Date.now();
        await this.saveState();
    }

    public async addLog(log: SystemLog): Promise<void> {
        this.state.logs.push(log);
        await this.saveState();
    }

    public async addErrorRecord(error: ErrorRecord): Promise<void> {
        this.state.errorRecords.push(error);
        await this.saveState();
    }

    public async addPromptRun(run: PromptRun): Promise<void> {
        this.state.promptHistory.push(run);
        await this.saveState();
    }

    public async addActionResult(result: ActionResult): Promise<void> {
        this.state.actionHistory.push(result);
        await this.saveState();
    }

    public async addValidationResult(result: ValidationResult): Promise<void> {
        this.state.validations = this.state.validations.filter(item => item.taskId !== result.taskId);
        this.state.validations.push(result);
        await this.saveState();
    }

    public async addApproval(approval: ApprovalRequest): Promise<void> {
        this.state.approvals.push(approval);
        await this.saveState();
    }

    public async updateApproval(approvalId: string, status: ApprovalRequest['status']): Promise<void> {
        const approval = this.state.approvals.find(item => item.id === approvalId);

        if (!approval) {
            await this.addErrorRecord({
                id: `error_${Date.now()}`,
                source: 'JsonStateManager.updateApproval',
                message: `Approval not found: ${approvalId}`,
                relatedEntityId: approvalId,
                timestamp: Date.now()
            });
            return;
        }

        approval.status = status;
        approval.respondedAt = Date.now();
        await this.saveState();
    }

    // --- Prompt Queue CRUD ---

    public async addPrompt(prompt: Prompt): Promise<void> {
        this.state.prompts.push(prompt);
        await this.saveState();
    }

    public async updatePrompt(promptId: string, updates: Partial<Prompt>): Promise<void> {
        const prompt = this.state.prompts.find(item => item.id === promptId);

        if (!prompt) {
            await this.addErrorRecord({
                id: `error_${Date.now()}`,
                source: 'JsonStateManager.updatePrompt',
                message: `Prompt not found: ${promptId}`,
                relatedEntityId: promptId,
                timestamp: Date.now()
            });
            return;
        }

        Object.assign(prompt, updates, { updatedAt: Date.now() });
        await this.saveState();
    }

    public async replacePrompts(prompts: Prompt[]): Promise<void> {
        this.state.prompts = [...prompts];
        await this.saveState();
    }

    private mergeWithDefaults(value: Partial<AppState> | undefined): AppState {
        return {
            ...createEmptyState(),
            ...value,
            tasks: value?.tasks || [],
            steps: value?.steps || [],
            approvals: value?.approvals || [],
            prompts: value?.prompts || [],
            promptHistory: value?.promptHistory || [],
            actionHistory: value?.actionHistory || [],
            validations: value?.validations || [],
            logs: value?.logs || [],
            errorRecords: value?.errorRecords || []
        };
    }

    private clone<T>(value: T): T {
        return JSON.parse(JSON.stringify(value)) as T;
    }
}
