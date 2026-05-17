import * as fs from 'fs';
import * as vscode from 'vscode';
import { PromptRun } from '../core/types';
import { Orchestrator } from '../core/orchestrator/Orchestrator';
import { loadProviderRuntimeConfig } from '../providers/providerConfig';
import { JsonStateManager } from '../store/JsonStateManager';
import { WorkspaceScanner, WorkspaceScanResult } from '../services/workspace/WorkspaceScanner';

// ---------------------------------------------------------------------------
// Mesaj Tipleri (UI <-> Controller Kontratı)
// ---------------------------------------------------------------------------

interface PanelMessage {
    command?:
        | 'panelReady'
        | 'splitTasks'
        | 'generateWorkflow'
        | 'selectTask'
        | 'generatePrompt'
        | 'simulateApprovalAction'
        | 'approveRequest'
        | 'rejectRequest'
        // Prompt Workflow
        | 'generateAllPrompts'
        | 'approvePrompt'
        | 'rejectPrompt'
        | 'approveAllDraftPrompts'
        | 'rejectAllDraftPrompts'
        | 'executeApprovedPrompts'
        | 'updatePromptContent'
        | 'cancelQueue'
        | 'markPromptSent'
        | 'markPromptCompleted'
        | 'addPromptNote'
        | 'changeProvider'
        | 'scanWorkspace';
    payload?: {
        projectTitle?: string;
        todoText?: string;
        ideaText?: string;
        taskId?: string;
        approvalId?: string;
        promptId?: string;
        promptIds?: string[];
        content?: string;
        note?: string;
    };
}

// ---------------------------------------------------------------------------
// Controller: Sadece UI Bridge
// ---------------------------------------------------------------------------

export class WebviewPanelController {
    private static currentPanel: WebviewPanelController | undefined;

    private readonly extensionContext: vscode.ExtensionContext;
    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private readonly disposables: vscode.Disposable[] = [];

    // Sistemin beyni — tüm iş mantığı burada yaşar
    private readonly orchestrator: Orchestrator;

    // Workspace tarama sonucu (bellekte tutulur, state dosyasına yazılmaz)
    private workspaceScanResult: WorkspaceScanResult | null = null;

    private constructor(context: vscode.ExtensionContext, panel: vscode.WebviewPanel) {
        this.extensionContext = context;
        this.panel = panel;
        this.extensionUri = context.extensionUri;

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || __dirname;
        const stateManager = new JsonStateManager(workspaceRoot);

        // Orchestrator'ı oluştur
        this.orchestrator = new Orchestrator(stateManager, workspaceRoot);

        // Orchestrator olaylarını dinle → UI'ı güncelle
        this.disposables.push(
            new vscode.Disposable(
                this.orchestrator.on('stateChanged', () => {
                    void this.syncState();
                })
            )
        );

        // Panel yaşam döngüsü
        this.disposables.push(
            this.panel.onDidDispose(() => this.dispose()),
            this.panel.webview.onDidReceiveMessage((message) => {
                void this.handleMessage(message as PanelMessage);
            })
        );

        this.panel.webview.html = this.getWebviewContent();
        void this.initialize();
    }

    public static render(context: vscode.ExtensionContext): void {
        if (WebviewPanelController.currentPanel) {
            WebviewPanelController.currentPanel.panel.reveal(vscode.ViewColumn.One);
            void WebviewPanelController.currentPanel.syncState();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'ai-task-orchestrator.panel',
            'AI Task Orchestrator',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'webview-ui')]
            }
        );

        WebviewPanelController.currentPanel = new WebviewPanelController(context, panel);
    }

    public dispose(): void {
        WebviewPanelController.currentPanel = undefined;
        this.panel.dispose();

        while (this.disposables.length > 0) {
            this.disposables.pop()?.dispose();
        }
    }

    // -----------------------------------------------------------------------
    // Yaşam Döngüsü
    // -----------------------------------------------------------------------

    private async initialize(): Promise<void> {
        const providerConfig = await loadProviderRuntimeConfig(this.extensionContext);
        await this.orchestrator.initialize(providerConfig);
        await this.syncState();
    }

    // -----------------------------------------------------------------------
    // Mesaj Yönlendirmesi (Thin Router)
    // Controller hiçbir iş mantığı çalıştırmaz; sadece Orchestrator'a paslar.
    // -----------------------------------------------------------------------

    private async handleMessage(message: PanelMessage): Promise<void> {
        switch (message.command) {
            case 'panelReady':
                await this.syncState();
                return;

            case 'splitTasks':
                await this.orchestrator.splitTasks(
                    message.payload?.projectTitle ?? '',
                    message.payload?.todoText ?? ''
                );
                return;

            case 'generateWorkflow':
                if (message.payload?.ideaText) {
                    await this.orchestrator.generateWorkflowFromIdea(message.payload.ideaText);
                }
                return;

            case 'selectTask':
                if (message.payload?.taskId) {
                    await this.orchestrator.selectTask(message.payload.taskId);
                }
                return;

            case 'generatePrompt':
                await this.orchestrator.generatePrompt(message.payload?.taskId);
                return;

            case 'simulateApprovalAction':
                await this.orchestrator.simulateApprovalAction(message.payload?.taskId);
                return;

            case 'approveRequest':
                if (message.payload?.approvalId) {
                    await this.orchestrator.resolveApproval(message.payload.approvalId, true);
                }
                return;

            case 'rejectRequest':
                if (message.payload?.approvalId) {
                    await this.orchestrator.resolveApproval(message.payload.approvalId, false);
                }
                return;

            // --- Prompt Workflow ---

            case 'generateAllPrompts':
                await this.orchestrator.generateAllPrompts();
                return;

            case 'approvePrompt':
                if (message.payload?.promptId) {
                    await this.orchestrator.approvePrompts([message.payload.promptId]);
                }
                return;

            case 'rejectPrompt':
                if (message.payload?.promptId) {
                    await this.orchestrator.rejectPrompts([message.payload.promptId]);
                }
                return;

            case 'approveAllDraftPrompts':
                await this.orchestrator.approveAllDraftPrompts();
                return;

            case 'rejectAllDraftPrompts':
                await this.orchestrator.rejectAllDraftPrompts();
                return;

            case 'executeApprovedPrompts':
                await this.orchestrator.executeApprovedPrompts();
                return;

            case 'updatePromptContent':
                if (message.payload?.promptId && message.payload?.content !== undefined) {
                    await this.orchestrator.updatePromptContent(message.payload.promptId, message.payload.content);
                }
                return;

            case 'markPromptSent':
                if (message.payload?.promptId) {
                    await this.orchestrator.markPromptSent(message.payload.promptId);
                }
                return;

            case 'markPromptCompleted':
                if (message.payload?.promptId) {
                    await this.orchestrator.markPromptCompleted(message.payload.promptId, message.payload.content);
                }
                return;

            case 'addPromptNote':
                if (message.payload?.promptId && message.payload?.note !== undefined) {
                    await this.orchestrator.addPromptNote(message.payload.promptId, message.payload.note);
                }
                return;

            case 'cancelQueue':
                this.orchestrator.cancelQueue();
                return;

            case 'changeProvider':
                await this.handleChangeProvider();
                return;

            case 'scanWorkspace':
                await this.handleScanWorkspace();
                return;

            default:
                return;
        }
    }

    // -----------------------------------------------------------------------
    // Provider Değiştirme (QuickPick)
    // -----------------------------------------------------------------------

    private async handleChangeProvider(): Promise<void> {
        const items: vscode.QuickPickItem[] = [
            {
                label: 'Mock · Simülasyon',
                description: 'Gerçek AI isteği yapmaz, test amaçlıdır',
                detail: 'mock'
            },
            {
                label: 'OpenAI',
                description: 'GPT modelleri ile çalışır',
                detail: 'openai'
            },
            {
                label: 'Gemini',
                description: 'Google Gemini modelleri ile çalışır',
                detail: 'gemini'
            }
        ];

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: 'AI sağlayıcı seçin',
            title: 'Provider Değiştir'
        });

        if (!picked || !picked.detail) {
            return; // Kullanıcı iptal etti
        }

        const selection = picked.detail as 'openai' | 'gemini' | 'mock';

        // VS Code ayarlarına yaz
        const config = vscode.workspace.getConfiguration('aiTaskOrchestrator');
        await config.update('provider', selection, vscode.ConfigurationTarget.Workspace);

        // Yeni config ile provider’ı yeniden bootstrap et
        const providerConfig = await loadProviderRuntimeConfig(this.extensionContext);
        await this.orchestrator.bootstrapProvider(providerConfig);

        // API key eksikse kullanıcıya sor
        const status = this.orchestrator.getProviderStatus();
        if (!status.available && selection !== 'mock') {
            const setKeyLabel = selection === 'openai' ? 'OpenAI API Key Gir' : 'Gemini API Key Gir';
            const setKeyCommand =
                selection === 'openai'
                    ? 'ai-task-orchestrator.setOpenAIApiKey'
                    : 'ai-task-orchestrator.setGeminiApiKey';

            const action = await vscode.window.showWarningMessage(
                `${picked.label} seçildi ancak API key bulunamadı.`,
                setKeyLabel
            );

            if (action === setKeyLabel) {
                await vscode.commands.executeCommand(setKeyCommand);

                // Key girildikten sonra tekrar bootstrap et
                const updatedConfig = await loadProviderRuntimeConfig(this.extensionContext);
                await this.orchestrator.bootstrapProvider(updatedConfig);
            }
        }

        await this.syncState();
    }

    // -----------------------------------------------------------------------
    // Workspace Tarama
    // -----------------------------------------------------------------------

    private async handleScanWorkspace(): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            void vscode.window.showWarningMessage('Açık bir workspace bulunamadı. Lütfen bir klasör açın.');
            return;
        }

        try {
            const scanner = new WorkspaceScanner(workspaceRoot);
            this.workspaceScanResult = await scanner.scan();
            this.orchestrator.setWorkspaceContext(this.workspaceScanResult);
            await this.syncState();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Workspace tarama hatası:', message);
            void vscode.window.showErrorMessage(`Workspace tarama başarısız: ${message}`);
        }
    }

    // -----------------------------------------------------------------------
    // State → UI Senkronizasyonu
    // Orchestrator'dan mevcut durumu alıp Webview'e gönderir.
    // -----------------------------------------------------------------------

    private async syncState(): Promise<void> {
        const state = this.orchestrator.getState();
        const selectedTaskId = this.orchestrator.getSelectedTaskId();
        const latestPrompt = this.orchestrator.getLatestPrompt();
        const providerStatus = this.orchestrator.getProviderStatus();

        const selectedTask = state.tasks.find((t) => t.id === selectedTaskId);
        const promptHistory = state.promptHistory
            .slice()
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 10);
        const approvals = state.approvals
            .filter((approval) => approval.status === 'pending')
            .sort((a, b) => b.requestedAt - a.requestedAt);
        const validationsByTaskId = new Map(state.validations.map((item) => [item.taskId, item]));

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const workspaceName = workspaceFolder?.name || '';
        // Güvenli kısaltılmış path: sadece son 2 segment göster
        const workspacePath = workspaceFolder ? workspaceFolder.uri.fsPath.split(/[\\/]/).slice(-2).join('/') : '';

        await this.panel.webview.postMessage({
            command: 'renderState',
            payload: {
                workspace: {
                    name: workspaceName,
                    shortPath: workspacePath,
                    scan: this.workspaceScanResult,
                    hasContext: this.orchestrator.hasWorkspaceContext()
                },
                projectTitle: state.currentProject?.title || 'AI Task Orchestrator',
                tasks: state.tasks.map((task) => ({
                    id: task.id,
                    title: task.title,
                    description: task.description,
                    status: task.status,
                    validationStatus: validationsByTaskId.get(task.id)?.status,
                    selected: task.id === selectedTaskId
                })),
                selectedTask: selectedTask
                    ? {
                          id: selectedTask.id,
                          title: selectedTask.title,
                          description: selectedTask.description,
                          type: selectedTask.type || 'code_generation',
                          validation: validationsByTaskId.get(selectedTask.id) || null
                      }
                    : null,
                prompt: latestPrompt
                    ? {
                          templateName: latestPrompt.templateName,
                          systemPrompt: latestPrompt.systemPrompt,
                          userPrompt: latestPrompt.userPrompt
                      }
                    : null,
                promptHistory: promptHistory.map((item: PromptRun) => ({
                    id: item.id,
                    taskId: item.taskId,
                    createdAt: item.createdAt
                })),
                approvals: approvals.map((item) => ({
                    id: item.id,
                    status: item.status,
                    severity: item.severity,
                    reason: item.reason,
                    actionSummary: item.actionSummary || 'Onay bekleyen işlem'
                })),
                validations: state.validations,
                prompts: (state.prompts || []).map((p) => ({
                    id: p.id,
                    taskId: p.taskId,
                    title: p.title,
                    content: p.content,
                    systemPrompt: p.systemPrompt,
                    templateName: p.templateName,
                    status: p.status,
                    executionMode: p.executionMode,
                    provider: p.provider,
                    responseText: p.responseText,
                    errorMessage: p.errorMessage,
                    executionResult: p.executionResult,
                    order: p.order,
                    createdAt: p.createdAt,
                    approvedAt: p.approvedAt,
                    completedAt: p.completedAt
                })),
                queueRunning: this.orchestrator.isQueueRunning(),
                providerStatus,
                logs: state.logs.slice(-80)
            }
        });
    }

    // -----------------------------------------------------------------------
    // Webview HTML Enjeksiyonu
    // -----------------------------------------------------------------------

    private getWebviewContent(): string {
        const webview = this.panel.webview;
        const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'index.html');
        const stylePath = vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'style.css');
        const scriptPath = vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'main.js');

        const styleUri = webview.asWebviewUri(stylePath);
        const scriptUri = webview.asWebviewUri(scriptPath);
        const nonce = this.createNonce();

        let html = fs.readFileSync(htmlPath.fsPath, 'utf8');
        html = html
            .replace(/{{cspSource}}/g, webview.cspSource)
            .replace(/{{styleUri}}/g, styleUri.toString())
            .replace(/{{scriptUri}}/g, scriptUri.toString())
            .replace(/{{nonce}}/g, nonce);

        return html;
    }

    private createNonce(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let value = '';

        for (let index = 0; index < 32; index += 1) {
            value += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        return value;
    }
}
