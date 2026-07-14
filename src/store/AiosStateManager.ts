import * as fs from 'fs/promises';
import { existsSync } from 'fs';
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
} from '../shared/types/sharedTypes';
import { Prompt } from '../core/types/prompt.types';
import { IStateManager } from './interfaces/IStateManager';

export class AiosStateManager implements IStateManager {
    private readonly workspaceRoot: string;
    private readonly aiosDir: string;
    private readonly oldStateFilePath: string;

    private readonly files: {
        project: string;
        tasks: string;
        logs: string;
        roadmap: string;
        memory: string;
    };

    private state: AppState = this.createEmptyState();

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.aiosDir = path.join(workspaceRoot, '.aios');
        this.oldStateFilePath = path.join(workspaceRoot, '.vscode', 'ai-orchestrator-state.json');

        this.files = {
            project: path.join(this.aiosDir, 'project.json'),
            tasks: path.join(this.aiosDir, 'tasks.json'),
            logs: path.join(this.aiosDir, 'logs.json'),
            roadmap: path.join(this.aiosDir, 'roadmap.json'),
            memory: path.join(this.aiosDir, 'memory.json')
        };
    }

    private createEmptyState(): AppState {
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

    public async init(): Promise<void> {
        try {
            await fs.mkdir(this.aiosDir, { recursive: true });

            // Check if migration is needed from old file
            if (existsSync(this.oldStateFilePath)) {
                await this.migrateFromOldState();
                return;
            }

            // Otherwise, load split files or init empty
            await this.loadSplitFiles();
        } catch (error) {
            console.error('Failed to initialize AiosStateManager:', error);
            this.state = this.createEmptyState();
            await this.saveState();
        }
    }

    private async migrateFromOldState(): Promise<void> {
        try {
            const data = await fs.readFile(this.oldStateFilePath, 'utf8');
            const parsed = JSON.parse(data);
            this.state = this.mergeWithDefaults(parsed);

            // Save split files to .aios/
            await this.saveSplitFiles();

            // Rename/Backup old file to avoid remigration
            const backupPath = `${this.oldStateFilePath}.backup`;
            await fs.rename(this.oldStateFilePath, backupPath);

            console.log(`Successfully migrated state to .aios/ and backed up old state to ${backupPath}`);
        } catch (error) {
            console.error('State migration failed, fallback to empty:', error);
            this.state = this.createEmptyState();
            await this.saveState();
        }
    }

    private async loadSplitFiles(): Promise<void> {
        this.state = this.createEmptyState();

        const projectExists = existsSync(this.files.project);
        const tasksExists = existsSync(this.files.tasks);
        const logsExists = existsSync(this.files.logs);

        if (!projectExists && !tasksExists && !logsExists) {
            // First time initialization: write initial empty files to disk
            await this.saveSplitFiles();
            return;
        }

        // 1. Project
        if (projectExists) {
            try {
                const data = await fs.readFile(this.files.project, 'utf8');
                const parsed = JSON.parse(data);
                this.state.currentProject = parsed.currentProject;
            } catch (e) {
                console.error('Failed to load project.json:', e);
            }
        }

        // 2. Tasks (tasks, steps, approvals, validations, promptHistory, actionHistory, prompts)
        if (tasksExists) {
            try {
                const data = await fs.readFile(this.files.tasks, 'utf8');
                const parsed = JSON.parse(data);
                this.state.tasks = parsed.tasks || [];
                this.state.steps = parsed.steps || [];
                this.state.approvals = parsed.approvals || [];
                this.state.validations = parsed.validations || [];
                this.state.prompts = parsed.prompts || [];
                this.state.promptHistory = parsed.promptHistory || [];
                this.state.actionHistory = parsed.actionHistory || [];
            } catch (e) {
                console.error('Failed to load tasks.json:', e);
            }
        }

        // 3. Logs (logs, errorRecords)
        if (logsExists) {
            try {
                const data = await fs.readFile(this.files.logs, 'utf8');
                const parsed = JSON.parse(data);
                this.state.logs = parsed.logs || [];
                this.state.errorRecords = parsed.errorRecords || [];
            } catch (e) {
                console.error('Failed to load logs.json:', e);
            }
        }
    }

    private async saveSplitFiles(): Promise<void> {
        // Save project.json
        const projectData = { currentProject: this.state.currentProject };
        await fs.writeFile(this.files.project, JSON.stringify(projectData, null, 2), 'utf8');

        // Save tasks.json
        const tasksData = {
            tasks: this.state.tasks,
            steps: this.state.steps,
            approvals: this.state.approvals,
            validations: this.state.validations,
            prompts: this.state.prompts,
            promptHistory: this.state.promptHistory,
            actionHistory: this.state.actionHistory
        };
        await fs.writeFile(this.files.tasks, JSON.stringify(tasksData, null, 2), 'utf8');

        // Save logs.json
        const logsData = {
            logs: this.state.logs,
            errorRecords: this.state.errorRecords
        };
        await fs.writeFile(this.files.logs, JSON.stringify(logsData, null, 2), 'utf8');
    }

    public async getState(): Promise<AppState> {
        return this.clone(this.state);
    }

    public async saveState(state?: AppState): Promise<void> {
        if (state) {
            this.state = this.mergeWithDefaults(state);
        }
        await this.saveSplitFiles();
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
        this.state.prompts = this.state.prompts.filter((prompt) => tasks.some((task) => task.id === prompt.taskId));
        this.state.approvals = this.state.approvals.filter((approval) =>
            tasks.some((task) => task.id === approval.taskId)
        );
        this.state.promptHistory = this.state.promptHistory.filter((run) =>
            tasks.some((task) => task.id === run.taskId)
        );
        this.state.validations = this.state.validations.filter((result) =>
            tasks.some((task) => task.id === result.taskId)
        );
        await this.saveState();
    }

    public async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
        const task = this.state.tasks.find((item) => item.id === taskId);
        if (!task) {
            await this.addErrorRecord({
                id: `error_${Date.now()}`,
                source: 'AiosStateManager.updateTaskStatus',
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
        this.state.validations = this.state.validations.filter((item) => item.taskId !== result.taskId);
        this.state.validations.push(result);
        await this.saveState();
    }

    public async addApproval(approval: ApprovalRequest): Promise<void> {
        this.state.approvals.push(approval);
        await this.saveState();
    }

    public async updateApproval(approvalId: string, status: ApprovalRequest['status']): Promise<void> {
        const approval = this.state.approvals.find((item) => item.id === approvalId);
        if (!approval) {
            await this.addErrorRecord({
                id: `error_${Date.now()}`,
                source: 'AiosStateManager.updateApproval',
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

    public async addPrompt(prompt: Prompt): Promise<void> {
        this.state.prompts.push(prompt);
        await this.saveState();
    }

    public async updatePrompt(promptId: string, updates: Partial<Prompt>): Promise<void> {
        const prompt = this.state.prompts.find((item) => item.id === promptId);
        if (!prompt) {
            await this.addErrorRecord({
                id: `error_${Date.now()}`,
                source: 'AiosStateManager.updatePrompt',
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
            ...this.createEmptyState(),
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
