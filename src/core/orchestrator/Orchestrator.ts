import { EventEmitter } from 'events';
import {
    ActionRequest,
    AppState,
    ApprovalRequest,
    Project,
    PromptRun,
    SystemLog,
    Task,
    ValidationResult
} from '../types';
import { Prompt, createPrompt, PromptStatus } from '../types/prompt.types';
import { TaskPlanner, PlannerOptions } from './TaskPlanner';
import { PromptGenerator, GeneratedPrompt } from './PromptGenerator';
import { PromptQueueManager, QueueExecutionSummary } from './PromptQueueManager';
import { ValidationEngine } from '../validator/ValidationEngine';
import { ActionEngine } from '../../services/action/ActionEngine';
import { ApprovalManager } from '../../services/approval/ApprovalManager';
import { IStateManager } from '../../store/interfaces/IStateManager';
import { IAIProvider } from '../../providers/interfaces/IAIProvider';
import { createProvider, ProviderStatus, ProviderBootstrapResult } from '../../providers/createProvider';
import { ProviderRuntimeConfig } from '../../providers/providerConfig';

// ---------------------------------------------------------------------------
// Olay Tipleri (Event Types)
// Controller (veya başka bir tüketici) bu olayları dinleyerek UI'ı günceller.
// ---------------------------------------------------------------------------

export interface OrchestratorEvents {
    stateChanged: (state: AppState) => void;
    logAdded: (log: SystemLog) => void;
    promptGenerated: (prompt: GeneratedPrompt) => void;
    promptStatusChanged: (prompt: Prompt, oldStatus: PromptStatus, newStatus: PromptStatus) => void;
    queueCompleted: (summary: QueueExecutionSummary) => void;
    approvalCreated: (approval: ApprovalRequest) => void;
    approvalResolved: (approval: ApprovalRequest, approved: boolean) => void;
    providerStatusChanged: (status: ProviderStatus) => void;
}

type EventName = keyof OrchestratorEvents;

// ---------------------------------------------------------------------------
// Orchestrator: Sistemin Beyni
// ---------------------------------------------------------------------------

export class Orchestrator {
    private readonly events = new EventEmitter();

    // Alt Servisler
    private readonly stateManager: IStateManager;
    private readonly approvalManager: ApprovalManager;
    private readonly actionEngine: ActionEngine;
    private readonly promptGenerator: PromptGenerator;
    private readonly validationEngine: ValidationEngine;
    private readonly queueManager: PromptQueueManager;
    private taskPlanner: TaskPlanner;

    // Durum
    private providerStatus: ProviderStatus = {
        selection: 'openai',
        active: 'none',
        available: false,
        severity: 'error',
        label: 'Provider yüklenmedi',
        message: 'Provider configuration has not been resolved yet.'
    };

    private state: AppState = {
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

    private selectedTaskId?: string;
    private latestPrompt?: GeneratedPrompt;

    constructor(
        stateManager: IStateManager,
        workspaceRoot: string
    ) {
        this.stateManager = stateManager;
        this.approvalManager = new ApprovalManager(stateManager);
        this.actionEngine = new ActionEngine(this.approvalManager, workspaceRoot);
        this.promptGenerator = new PromptGenerator();
        this.validationEngine = new ValidationEngine(workspaceRoot);
        this.queueManager = new PromptQueueManager(stateManager);
        this.taskPlanner = new TaskPlanner();

        // ApprovalManager olaylarını dinle ve dışarıya ilet
        this.approvalManager.onApprovalCreated(approval => {
            void this.onApprovalCreated(approval);
        });

        this.approvalManager.onApprovalResolved((approval, approved) => {
            void this.onApprovalResolved(approval, approved);
        });

        // PromptQueueManager olaylarını dinle
        this.queueManager.on('promptStatusChanged', (prompt, oldStatus, newStatus) => {
            this.events.emit('promptStatusChanged', prompt, oldStatus, newStatus);
            void this.refreshAndEmit();
        });

        this.queueManager.on('queueCompleted', (summary) => {
            this.events.emit('queueCompleted', summary);
            void this.onQueueCompleted(summary);
        });

        this.queueManager.on('queueError', (prompt, error) => {
            void this.log('error', `Prompt başarısız: "${prompt.title}" — ${error}`);
        });
    }

    // -----------------------------------------------------------------------
    // Olay Aboneliği (Event Subscription)
    // -----------------------------------------------------------------------

    public on<K extends EventName>(event: K, listener: OrchestratorEvents[K]): () => void {
        this.events.on(event, listener);
        return () => { this.events.off(event, listener); };
    }

    // -----------------------------------------------------------------------
    // Yaşam Döngüsü (Lifecycle)
    // -----------------------------------------------------------------------

    public async initialize(providerConfig: ProviderRuntimeConfig): Promise<void> {
        await (this.stateManager as any).init?.();
        this.state = await this.stateManager.getState();
        this.selectedTaskId = this.state.tasks[0]?.id;

        await this.bootstrapProvider(providerConfig);
        await this.log('info', 'Orchestrator başlatıldı. Oturum hazır.');
        this.emitStateChanged();
    }

    public async bootstrapProvider(config: ProviderRuntimeConfig): Promise<void> {
        const bootstrap: ProviderBootstrapResult = createProvider(config);
        this.providerStatus = bootstrap.status;
        this.taskPlanner = new TaskPlanner({ aiProvider: bootstrap.provider });

        await this.log(
            this.providerStatus.available ? 'info' : 'error',
            this.providerStatus.message
        );

        if (!this.providerStatus.available && this.providerStatus.selection !== 'mock') {
            await this.log(
                'info',
                'AI provider unavailable. Task planning will continue in deterministic local mode.'
            );
        }

        this.events.emit('providerStatusChanged', this.providerStatus);

        // Queue manager'a da provider'ı ver
        this.queueManager.setProvider(bootstrap.provider);
    }

    // -----------------------------------------------------------------------
    // İş Akışları (Business Flows)
    // -----------------------------------------------------------------------

    /**
     * Kullanıcının girdiği fikirden yola çıkarak önce görevleri planlar,
     * sonra da her görev için otomatik olarak promptları üretir.
     */
    public async generateWorkflowFromIdea(ideaText: string): Promise<void> {
        const normalizedInput = ideaText.trim();
        if (!normalizedInput) {
            await this.log('error', 'Fikir üretmek için geçerli bir metin girin.');
            this.emitStateChanged();
            return;
        }

        await this.log('info', 'Fikirden iş akışı üretiliyor...');

        // 1. Proje başlığını çıkar (ilk 50 karakter veya ilk cümle)
        const firstLine = normalizedInput.split('\n')[0];
        let projectTitle = firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
        
        // 2. Taskları oluştur
        await this.splitTasks(projectTitle, normalizedInput);
        
        // splitTasks başarılı olursa, beklemedeki tüm tasklar için prompt üret
        if (this.state.tasks.length > 0) {
            await this.generateAllPrompts();
            await this.log('success', 'Fikir başarıyla görevlere bölündü ve promptları hazırlandı.');
        } else {
            await this.log('warn', 'Fikir işlendi ancak görev çıkarılamadı.');
        }
    }

    /**
     * Kullanıcının girdiği ham görev listesini parçalar ve state'e kaydeder.
     */
    public async splitTasks(projectTitle: string, todoText: string): Promise<void> {
        const normalizedTitle = projectTitle.trim() || 'AI Task Orchestrator';
        this.latestPrompt = undefined;

        if (!todoText.trim()) {
            await this.log('error', 'Görevleri parçalamak için yapılacaklar listesi girin.');
            this.emitStateChanged();
            return;
        }

        await this.log('info', 'Task Planner çalıştırılıyor...');

        const project = this.createProject(normalizedTitle, todoText);
        await this.stateManager.setProject(project);

        this.state.tasks = await this.taskPlanner.planTasks(todoText, project.id);
        await (this.stateManager as any).replaceTasks?.(this.state.tasks);
        this.selectedTaskId = this.state.tasks[0]?.id;
        this.state = await this.stateManager.getState();

        await this.log('success', `${this.state.tasks.length} görev üretildi.`);
        this.emitStateChanged();
    }

    /**
     * Belirtilen görevi "seçili" olarak işaretler.
     */
    public async selectTask(taskId: string): Promise<void> {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task) {
            await this.log('error', 'Görev mevcut listede bulunamadı.');
            this.emitStateChanged();
            return;
        }

        this.selectedTaskId = task.id;
        await this.log('info', `Kullanıcı '${task.title}' görevini seçti.`);
        this.emitStateChanged();
    }

    /**
     * Seçili veya verilen görev için prompt üretir ve geçmişe kaydeder.
     */
    public async generatePrompt(taskId?: string): Promise<void> {
        const task = this.resolveTask(taskId);
        if (!task) {
            await this.log('error', 'Prompt üretmek için önce bir görev seçin.');
            this.emitStateChanged();
            return;
        }

        this.selectedTaskId = task.id;
        await this.log('info', `Prompt Generator '${task.title}' için çalıştırılıyor.`);

        this.latestPrompt = this.promptGenerator.generate(task);
        const promptRun = this.promptGenerator.createPromptRunRecord(task, this.latestPrompt);
        await this.stateManager.addPromptRun(promptRun);
        this.state = await this.stateManager.getState();

        await this.log('success', `Prompt üretildi: ${this.latestPrompt.templateName}`);
        this.events.emit('promptGenerated', this.latestPrompt);
        this.emitStateChanged();
    }

    /**
     * Onay akışını test etmek için sahte bir tehlikeli eylem oluşturur.
     */
    public async simulateApprovalAction(taskId?: string): Promise<void> {
        const task = this.resolveTask(taskId);
        if (!task) {
            await this.log('error', 'Approval akışı için önce bir görev seçin.');
            this.emitStateChanged();
            return;
        }

        const action: ActionRequest = {
            id: `action_${Date.now()}`,
            type: 'run_terminal_command',
            payload: { command: 'npm install express' }
        };

        this.selectedTaskId = task.id;
        await this.log('info', `Approval simülasyonu başlatıldı: ${task.title}`);
        this.emitStateChanged();

        const response = await this.actionEngine.executeWithDetails(action, task.id);
        await this.stateManager.addActionResult(response.result);
        this.state = await this.stateManager.getState();

        await this.log(
            response.result.success ? 'success' : 'error',
            response.result.output || 'Aksiyon sonucu alındı.'
        );
        this.emitStateChanged();
    }

    /**
     * Kullanıcı onay/ret kararını ApprovalManager'a iletir.
     */
    public async resolveApproval(approvalId: string, approved: boolean): Promise<void> {
        try {
            await this.approvalManager.resolveApproval(approvalId, approved);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await this.log('error', `Onay cevabı işlenemedi: ${message}`);
            this.emitStateChanged();
        }
    }

    // -----------------------------------------------------------------------
    // Prompt Workflow (Yeni)
    // -----------------------------------------------------------------------

    /**
     * Tüm pending görevler için prompt üretir ve state'e 'draft' olarak kaydeder.
     */
    public async generateAllPrompts(): Promise<void> {
        const pendingTasks = this.state.tasks.filter(t => t.status === 'pending');

        if (pendingTasks.length === 0) {
            await this.log('error', 'Prompt üretilecek görev bulunamadı.');
            this.emitStateChanged();
            return;
        }

        await this.log('info', `${pendingTasks.length} görev için promptlar üretiliyor...`);

        const existingPromptTaskIds = new Set(this.state.prompts.map(prompt => prompt.taskId));
        let generatedCount = 0;

        for (const task of pendingTasks) {
            if (existingPromptTaskIds.has(task.id)) {
                continue;
            }

            const generated = this.promptGenerator.generate(task);

            const prompt = createPrompt({
                taskId: task.id,
                title: `${task.title}`,
                systemPrompt: generated.systemPrompt,
                content: generated.userPrompt,
                templateName: generated.templateName,
                order: task.order
            });

            await this.stateManager.addPrompt(prompt);
            existingPromptTaskIds.add(task.id);
            generatedCount += 1;
        }

        this.state = await this.stateManager.getState();
        await this.log(
            'success',
            generatedCount > 0
                ? `${generatedCount} prompt 'draft' olarak üretildi. İnceleme bekleniyor.`
                : 'Tüm bekleyen görevler için prompt zaten mevcut.'
        );
        this.emitStateChanged();
    }

    /**
     * Seçili prompt'ları onayla (draft → approved).
     */
    public async approvePrompts(promptIds: string[]): Promise<void> {
        try {
            await this.queueManager.approveMany(promptIds);
            this.state = await this.stateManager.getState();
            await this.log('success', `${promptIds.length} prompt onaylandı.`);
            this.emitStateChanged();
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            await this.log('error', `Prompt onay hatası: ${msg}`);
            this.emitStateChanged();
        }
    }

    /**
     * Seçili prompt'ları reddet (draft → rejected).
     */
    public async rejectPrompts(promptIds: string[]): Promise<void> {
        try {
            await this.queueManager.rejectMany(promptIds);
            this.state = await this.stateManager.getState();
            await this.log('info', `${promptIds.length} prompt reddedildi.`);
            this.emitStateChanged();
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            await this.log('error', `Prompt red hatası: ${msg}`);
            this.emitStateChanged();
        }
    }

    /**
     * Tüm draft prompt'ları toplu onayla.
     */
    public async approveAllDraftPrompts(): Promise<void> {
        const draftIds = this.state.prompts
            .filter(p => p.status === 'draft')
            .map(p => p.id);

        if (draftIds.length === 0) {
            await this.log('info', 'Onaylanacak draft prompt yok.');
            this.emitStateChanged();
            return;
        }

        await this.approvePrompts(draftIds);
    }

    /**
     * Tüm draft prompt'ları toplu reddet.
     */
    public async rejectAllDraftPrompts(): Promise<void> {
        const draftIds = this.state.prompts
            .filter(p => p.status === 'draft')
            .map(p => p.id);

        if (draftIds.length === 0) {
            await this.log('info', 'Reddedilecek draft prompt yok.');
            this.emitStateChanged();
            return;
        }

        await this.rejectPrompts(draftIds);
    }

    /**
     * Onaylı (approved) prompt'ları sıralı yürütme kuyruğuna alır.
     */
    public async executeApprovedPrompts(): Promise<void> {
        const approvedCount = this.state.prompts.filter(p => p.status === 'approved').length;

        if (approvedCount === 0) {
            await this.log('error', 'Kuyruğa alınacak onaylı prompt yok.');
            this.emitStateChanged();
            return;
        }

        if (this.queueManager.isRunning()) {
            await this.log('error', 'Kuyruk zaten çalışıyor.');
            this.emitStateChanged();
            return;
        }

        await this.log('info', `${approvedCount} onaylı prompt kuyruğa alınıyor...`);
        this.emitStateChanged();

        // executeQueue arka planda (non-blocking) çalışır; olaylar üzerinden UI güncellenecek
        void this.queueManager.executeQueue();
    }

    /**
     * Tek bir prompt'un içeriğini düzenleme.
     */
    public async updatePromptContent(promptId: string, newContent: string): Promise<void> {
        await this.stateManager.updatePrompt(promptId, { content: newContent });
        this.state = await this.stateManager.getState();
        await this.log('info', 'Prompt içeriği güncellendi.');
        this.emitStateChanged();
    }

    /**
     * Prompt'u manuel olarak gönderildi işaretler.
     */
    public async markPromptSent(promptId: string): Promise<void> {
        try {
            await this.queueManager.transition(promptId, 'sent_manually');
            await this.log('info', `Prompt manuel olarak gönderildi olarak işaretlendi.`);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            await this.log('error', `Prompt durum güncellenemedi: ${msg}`);
        }
    }

    /**
     * Prompt'u manuel olarak tamamlandı işaretler.
     */
    public async markPromptCompleted(promptId: string, resultText?: string): Promise<void> {
        try {
            if (resultText) {
                await this.stateManager.updatePrompt(promptId, { responseText: resultText });
            }
            await this.queueManager.transition(promptId, 'manually_completed');
            await this.log('success', `Prompt manuel olarak tamamlandı.`);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            await this.log('error', `Prompt tamamlanamadı: ${msg}`);
        }
    }

    /**
     * Prompt için manuel not ekler.
     */
    public async addPromptNote(promptId: string, note: string): Promise<void> {
        try {
            const state = await this.stateManager.getState();
            const prompt = state.prompts.find(p => p.id === promptId);
            if (prompt) {
                const currentResponse = prompt.responseText || '';
                const newResponse = currentResponse ? `${currentResponse}\n\n[Not]: ${note}` : `[Not]: ${note}`;
                await this.stateManager.updatePrompt(promptId, { responseText: newResponse });
                await this.refreshAndEmit();
                await this.log('info', `Prompta not eklendi.`);
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            await this.log('error', `Not eklenemedi: ${msg}`);
        }
    }

    /**
     * Çalışan kuyruğu iptal eder.
     */
    public cancelQueue(): void {
        this.queueManager.requestCancel();
    }

    public isQueueRunning(): boolean {
        return this.queueManager.isRunning();
    }

    // -----------------------------------------------------------------------
    // Durum Sorgulama (Getters)
    // -----------------------------------------------------------------------

    public getState(): AppState {
        return this.state;
    }

    public getSelectedTaskId(): string | undefined {
        return this.selectedTaskId;
    }

    public getLatestPrompt(): GeneratedPrompt | undefined {
        return this.latestPrompt;
    }

    public getProviderStatus(): ProviderStatus {
        return this.providerStatus;
    }

    // -----------------------------------------------------------------------
    // ApprovalManager Olay Yöneticileri (Internal Event Handlers)
    // -----------------------------------------------------------------------

    private async onApprovalCreated(approval: ApprovalRequest): Promise<void> {
        this.state = await this.stateManager.getState();
        await this.log('info', `Onay bekleniyor: ${approval.actionSummary || approval.reason}`);
        this.events.emit('approvalCreated', approval);
        this.emitStateChanged();
    }

    private async onApprovalResolved(approval: ApprovalRequest, approved: boolean): Promise<void> {
        this.state = await this.stateManager.getState();
        await this.log(
            approved ? 'success' : 'error',
            approved
                ? `Kullanıcı işlemi onayladı: ${approval.actionSummary || approval.reason}`
                : `Kullanıcı işlemi reddetti: ${approval.actionSummary || approval.reason}`
        );
        this.events.emit('approvalResolved', approval, approved);
        this.emitStateChanged();
    }

    // -----------------------------------------------------------------------
    // Yardımcılar (Helpers)
    // -----------------------------------------------------------------------

    private resolveTask(taskId?: string): Task | undefined {
        const effectiveId = taskId || this.selectedTaskId;
        return this.state.tasks.find(t => t.id === effectiveId);
    }

    private createProject(title: string, description: string): Project {
        const now = Date.now();
        return { id: `project_${now}`, title, description, createdAt: now, updatedAt: now };
    }

    private async log(level: SystemLog['level'], message: string): Promise<void> {
        const log: SystemLog = {
            id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            level,
            message,
            timestamp: Date.now()
        };

        await this.stateManager.addLog(log);
        this.state = await this.stateManager.getState();
        this.events.emit('logAdded', log);
    }

    private emitStateChanged(): void {
        this.events.emit('stateChanged', this.state);
    }

    private async refreshAndEmit(): Promise<void> {
        this.state = await this.stateManager.getState();
        this.emitStateChanged();
    }

    private async onQueueCompleted(summary: QueueExecutionSummary): Promise<void> {
        await this.log(
            summary.failed > 0 ? 'error' : 'success',
            `Kuyruk tamamlandı: ${summary.completed} başarılı, ${summary.failed} başarısız, ${summary.cancelled} iptal (${summary.durationMs}ms)`
        );
        this.emitStateChanged();
    }
}
