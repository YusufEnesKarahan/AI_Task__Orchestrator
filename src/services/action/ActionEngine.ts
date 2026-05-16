import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { ActionRequest, ActionResult } from '../../core/types';
import { ApprovalFlowResult, ApprovalManager } from '../approval/ApprovalManager';

export interface ReadFileInput {
    path: string;
}

export interface WriteFileInput {
    path: string;
    content: string;
}

export interface AppendFileInput {
    path: string;
    content: string;
}

export interface OpenFileInput {
    path: string;
}

export interface ListFilesInput {
    directory?: string;
}

export interface SearchProjectInput {
    query: string;
}

export interface ReadFileOutput {
    path: string;
    content: string;
}

export interface WriteFileOutput {
    path: string;
    bytesWritten: number;
}

export interface AppendFileOutput {
    path: string;
    bytesAppended: number;
}

export interface OpenFileOutput {
    path: string;
    opened: boolean;
}

export interface ListFilesOutput {
    directory: string;
    files: string[];
}

export interface SearchProjectOutput {
    query: string;
    results: string[];
}

export interface PendingApprovalOutput {
    reason: string;
    severity: string;
    summary: string;
}

export interface BlockedActionOutput {
    reason: string;
}

export type ActionOutput =
    | ReadFileOutput
    | WriteFileOutput
    | AppendFileOutput
    | OpenFileOutput
    | ListFilesOutput
    | SearchProjectOutput
    | PendingApprovalOutput
    | BlockedActionOutput;

export interface ActionExecutionResponse {
    result: ActionResult;
    approval?: ApprovalFlowResult;
    data?: ActionOutput;
}

type DeferredActionType = 'run_terminal_command' | 'apply_diff' | 'create_file' | 'delete_file';

export class ActionEngine {
    constructor(
        private readonly approvalManager: ApprovalManager,
        private readonly workspaceRoot: string
    ) {}

    public async execute(action: ActionRequest, taskId: string): Promise<ActionResult> {
        const response = await this.executeWithDetails(action, taskId);
        return response.result;
    }

    public async executeWithDetails(action: ActionRequest, taskId: string): Promise<ActionExecutionResponse> {
        const approval = await this.approvalManager.requestApprovalForAction(action, taskId);

        if (approval.decision.mode === 'blocked') {
            return {
                approval,
                data: { reason: approval.decision.reason },
                result: this.buildFailureResult(
                    action.id,
                    `Bariyer: İşlem güvenlik nedeniyle engellendi. Sebep: ${approval.decision.reason}`
                )
            };
        }

        if (approval.approvalRequest) {
            const approved = await this.approvalManager.waitForApproval(approval.approvalRequest.id);

            if (!approved) {
                return {
                    approval,
                    data: {
                        reason: approval.decision.reason,
                        severity: approval.decision.severity,
                        summary: approval.decision.actionSummary
                    },
                    result: this.buildFailureResult(
                        action.id,
                        `İşlem kullanıcı tarafından reddedildi. Sebep: ${approval.decision.reason}`
                    )
                };
            }
        }

        try {
            const data = await this.dispatch(action);

            return {
                approval,
                data,
                result: {
                    actionId: action.id,
                    success: true,
                    output: JSON.stringify(data),
                    executedAt: Date.now()
                }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            return {
                approval,
                result: this.buildFailureResult(action.id, `İşlem sırasında hata: ${message}`)
            };
        }
    }

    private async dispatch(action: ActionRequest): Promise<ActionOutput> {
        switch (action.type) {
            case 'read_file':
                return this.readFile(this.parsePayload<ReadFileInput>(action.payload, ['path']));
            case 'write_file':
                return this.writeFile(this.parsePayload<WriteFileInput>(action.payload, ['path', 'content']));
            case 'append_file':
                return this.appendFile(this.parsePayload<AppendFileInput>(action.payload, ['path', 'content']));
            case 'open_file':
                return this.openFile(this.parsePayload<OpenFileInput>(action.payload, ['path']));
            case 'list_files':
                return this.listFiles(this.parsePayload<ListFilesInput>(action.payload, []));
            case 'search_in_project':
                return this.searchInProject(this.parsePayload<SearchProjectInput>(action.payload, ['query']));
            case 'run_terminal_command':
            case 'apply_diff':
            case 'create_file':
            case 'delete_file':
                return this.handleDeferredAction(action.type);
            default:
                throw new Error(`Bilinmeyen eylem türü: ${action.type}`);
        }
    }

    private async readFile(input: ReadFileInput): Promise<ReadFileOutput> {
        const fullPath = this.resolvePath(input.path);
        const content = await fs.readFile(fullPath, 'utf8');

        return {
            path: input.path,
            content
        };
    }

    private async writeFile(input: WriteFileInput): Promise<WriteFileOutput> {
        const fullPath = this.resolvePath(input.path);
        await fs.writeFile(fullPath, input.content, 'utf8');

        return {
            path: input.path,
            bytesWritten: Buffer.byteLength(input.content, 'utf8')
        };
    }

    private async appendFile(input: AppendFileInput): Promise<AppendFileOutput> {
        const fullPath = this.resolvePath(input.path);
        await fs.appendFile(fullPath, input.content, 'utf8');

        return {
            path: input.path,
            bytesAppended: Buffer.byteLength(input.content, 'utf8')
        };
    }

    private async openFile(input: OpenFileInput): Promise<OpenFileOutput> {
        const fullPath = this.resolvePath(input.path);
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(fullPath));
        await vscode.window.showTextDocument(document, { preview: false });

        return {
            path: input.path,
            opened: true
        };
    }

    private async listFiles(input: ListFilesInput): Promise<ListFilesOutput> {
        const directory = input.directory || '.';
        const fullPath = this.resolvePath(directory);
        const entries = await fs.readdir(fullPath, { withFileTypes: true });

        return {
            directory,
            files: entries.map((entry) => entry.name)
        };
    }

    private async searchInProject(input: SearchProjectInput): Promise<SearchProjectOutput> {
        const uris = await vscode.workspace.findFiles(`**/*${input.query}*`, '**/node_modules/**');

        return {
            query: input.query,
            results: uris.map((uri) => uri.fsPath)
        };
    }

    private handleDeferredAction(actionType: DeferredActionType): any {
        // TODO: Activate these actions in phase 2 with stricter execution guards.
        return {
            reason: `Manuel yürütme gerekli: ${actionType}`
        };
    }

    private parsePayload<T>(payload: Record<string, any>, requiredKeys: string[]): T {
        for (const key of requiredKeys) {
            if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
                throw new Error(`Eksik aksiyon alanı: ${key}`);
            }
        }

        return payload as T;
    }

    private resolvePath(relativePath: string): string {
        const workspaceRoot = path.resolve(this.workspaceRoot);
        const fullPath = path.resolve(workspaceRoot, relativePath);
        const relativeToWorkspace = path.relative(workspaceRoot, fullPath);

        if (relativeToWorkspace.startsWith('..') || path.isAbsolute(relativeToWorkspace)) {
            throw new Error(`Güvenlik ihlali: Çalışma alanı dışına erişim yasaktır. İstenen yol: ${relativePath}`);
        }

        return fullPath;
    }

    private buildFailureResult(actionId: string, message: string): ActionResult {
        return {
            actionId,
            success: false,
            output: message,
            executedAt: Date.now()
        };
    }
}
