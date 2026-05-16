import { EventEmitter } from 'events';
import { ActionRequest, ApprovalRequest, ApprovalSeverity } from '../../core/types';
import { IStateManager } from '../../store/interfaces/IStateManager';

export type ApprovalMode = 'automatic' | 'approval_required' | 'blocked';

export interface ApprovalDecision {
    mode: ApprovalMode;
    reason: string;
    severity: ApprovalSeverity;
    riskTags: string[];
    actionSummary: string;
}

export interface ApprovalFlowResult {
    decision: ApprovalDecision;
    approvalRequest: ApprovalRequest | null;
}

export interface ApprovalEventMap {
    approvalCreated: (approval: ApprovalRequest) => void;
    approvalResolved: (approval: ApprovalRequest, approved: boolean) => void;
}

export class ApprovalManager {
    private readonly events = new EventEmitter();
    private readonly pendingApprovals = new Map<string, {
        resolve: (value: boolean) => void;
        reject: (reason?: unknown) => void;
        promise: Promise<boolean>;
    }>();
    private readonly settledApprovals = new Map<string, boolean>();

    constructor(private readonly stateManager: IStateManager) {}

    public onApprovalCreated(listener: ApprovalEventMap['approvalCreated']): () => void {
        this.events.on('approvalCreated', listener);
        return () => this.events.off('approvalCreated', listener);
    }

    public onApprovalResolved(listener: ApprovalEventMap['approvalResolved']): () => void {
        this.events.on('approvalResolved', listener);
        return () => this.events.off('approvalResolved', listener);
    }

    public evaluateAction(action: ActionRequest): ApprovalDecision {
        if (action.type === 'read_file' || action.type === 'open_file' || action.type === 'list_files' || action.type === 'search_in_project') {
            return {
                mode: 'automatic',
                reason: 'Salt-okunur işlem, otomatik çalıştırılabilir.',
                severity: 'low',
                riskTags: ['read-only'],
                actionSummary: this.buildActionSummary(action)
            };
        }

        if (action.type === 'delete_file') {
            return {
                mode: 'approval_required',
                reason: 'Dosya silme işlemi geri alınamaz etki yaratabilir.',
                severity: 'high',
                riskTags: ['delete', 'destructive'],
                actionSummary: this.buildActionSummary(action)
            };
        }

        if (action.type === 'write_file' || action.type === 'append_file' || action.type === 'apply_diff') {
            const fileCount = this.estimateAffectedFileCount(action);
            return {
                mode: fileCount > 1 ? 'approval_required' : 'automatic',
                reason: fileCount > 1
                    ? 'Birden fazla dosyayı etkileyen değişiklik onay gerektirir.'
                    : 'Tek dosyalık kontrollü değişiklik otomatik yürütülebilir.',
                severity: fileCount > 1 ? 'medium' : 'low',
                riskTags: fileCount > 1 ? ['multi-file-change'] : ['single-file-change'],
                actionSummary: this.buildActionSummary(action)
            };
        }

        if (action.type === 'create_file') {
            return {
                mode: 'automatic',
                reason: 'Yeni dosya oluşturma düşük riskli kabul edildi.',
                severity: 'low',
                riskTags: ['create-file'],
                actionSummary: this.buildActionSummary(action)
            };
        }

        if (action.type === 'run_terminal_command') {
            return this.evaluateTerminalCommand(action);
        }

        return {
            mode: 'blocked',
            reason: 'Bilinmeyen aksiyon tipi güvenlik nedeniyle bloklandı.',
            severity: 'high',
            riskTags: ['unknown-action'],
            actionSummary: this.buildActionSummary(action)
        };
    }

    public async createApprovalRequest(action: ActionRequest, taskId: string): Promise<ApprovalRequest | null> {
        const decision = this.evaluateAction(action);

        if (decision.mode !== 'approval_required') {
            return null;
        }

        const approval: ApprovalRequest = {
            id: `approval_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            actionId: action.id,
            taskId,
            status: 'pending',
            reason: decision.reason,
            severity: decision.severity,
            actionType: action.type,
            actionSummary: decision.actionSummary,
            riskTags: decision.riskTags,
            requestedAt: Date.now()
        };

        await this.stateManager.addApproval(approval);
        this.events.emit('approvalCreated', approval);
        return approval;
    }

    public async requestApprovalForAction(action: ActionRequest, taskId: string): Promise<ApprovalFlowResult> {
        const decision = this.evaluateAction(action);
        const approvalRequest = decision.mode === 'approval_required'
            ? await this.createApprovalRequest(action, taskId)
            : null;

        return {
            decision,
            approvalRequest
        };
    }

    public waitForApproval(approvalId: string): Promise<boolean> {
        const settled = this.settledApprovals.get(approvalId);
        if (settled !== undefined) {
            this.settledApprovals.delete(approvalId);
            return Promise.resolve(settled);
        }

        const existing = this.pendingApprovals.get(approvalId);
        if (existing) {
            return existing.promise;
        }

        let resolvePromise!: (value: boolean) => void;
        let rejectPromise!: (reason?: unknown) => void;
        const promise = new Promise<boolean>((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;
        });

        this.pendingApprovals.set(approvalId, {
            resolve: resolvePromise,
            reject: rejectPromise,
            promise
        });

        return promise;
    }

    public async resolveApproval(approvalId: string, approved: boolean): Promise<void> {
        const state = await this.stateManager.getState();
        const approval = state.approvals.find(item => item.id === approvalId);

        if (!approval) {
            throw new Error(`Approval not found: ${approvalId}`);
        }

        if (approval.status !== 'pending') {
            throw new Error(`Approval already resolved: ${approvalId}`);
        }

        const nextStatus: ApprovalRequest['status'] = approved ? 'approved' : 'rejected';
        await this.stateManager.updateApproval(approvalId, nextStatus);

        const resolver = this.pendingApprovals.get(approvalId);
        if (resolver) {
            this.pendingApprovals.delete(approvalId);
            resolver.resolve(approved);
        } else {
            this.settledApprovals.set(approvalId, approved);
        }

        const updatedState = await this.stateManager.getState();
        const updatedApproval = updatedState.approvals.find(item => item.id === approvalId);

        if (updatedApproval) {
            this.events.emit('approvalResolved', updatedApproval, approved);
        }
    }

    private evaluateTerminalCommand(action: ActionRequest): ApprovalDecision {
        const command = String(action.payload.command || '').trim();
        const normalizedCommand = command.toLowerCase();
        const summary = this.buildActionSummary(action);

        if (!command) {
            return {
                mode: 'blocked',
                reason: 'Boş terminal komutu çalıştırılamaz.',
                severity: 'high',
                riskTags: ['invalid-command'],
                actionSummary: summary
            };
        }

        if (this.matchesAny(normalizedCommand, ['npm install', 'pnpm add', 'yarn add', 'bun add'])) {
            return {
                mode: 'approval_required',
                reason: 'Bağımlılık yükleme işlemleri kullanıcı onayı gerektirir.',
                severity: 'high',
                riskTags: ['terminal', 'dependency-install'],
                actionSummary: summary
            };
        }

        if (normalizedCommand.startsWith('git ')) {
            return {
                mode: 'approval_required',
                reason: 'Git komutları repo geçmişini veya çalışma ağacını etkileyebilir.',
                severity: 'high',
                riskTags: ['terminal', 'git'],
                actionSummary: summary
            };
        }

        if (this.matchesAny(normalizedCommand, ['curl ', 'wget ', 'invoke-webrequest ', 'irm ', 'invoke-restmethod '])) {
            return {
                mode: 'approval_required',
                reason: 'Dış servislere istek atan komutlar onay gerektirir.',
                severity: 'high',
                riskTags: ['terminal', 'network'],
                actionSummary: summary
            };
        }

        if (this.matchesAny(normalizedCommand, ['rm ', 'del ', 'rmdir ', 'rd '])) {
            return {
                mode: 'approval_required',
                reason: 'Silme etkisi taşıyan terminal komutları onay gerektirir.',
                severity: 'high',
                riskTags: ['terminal', 'destructive'],
                actionSummary: summary
            };
        }

        return {
            mode: 'approval_required',
            reason: 'Terminal komutları ilk sürümde varsayılan olarak onaylı çalışır.',
            severity: 'medium',
            riskTags: ['terminal'],
            actionSummary: summary
        };
    }

    private buildActionSummary(action: ActionRequest): string {
        switch (action.type) {
            case 'run_terminal_command':
                return `Terminal command: ${String(action.payload.command || '').trim() || '(empty)'}`;
            case 'write_file':
            case 'append_file':
            case 'create_file':
            case 'delete_file':
                return `${action.type}: ${String(action.payload.path || action.payload.paths || '(no path provided)')}`;
            case 'apply_diff':
                return `apply_diff affecting ${this.estimateAffectedFileCount(action)} file(s)`;
            case 'read_file':
            case 'open_file':
                return `${action.type}: ${String(action.payload.path || '(no path provided)')}`;
            case 'list_files':
                return `list_files: ${String(action.payload.directory || './')}`;
            case 'search_in_project':
                return `search_in_project: ${String(action.payload.query || '')}`;
            default:
                return `${action.type}`;
        }
    }

    private estimateAffectedFileCount(action: ActionRequest): number {
        const payload = action.payload;

        if (Array.isArray(payload.paths)) {
            return payload.paths.length;
        }

        if (typeof payload.path === 'string' && payload.path.trim()) {
            return 1;
        }

        if (typeof payload.diff === 'string') {
            const matches = payload.diff.match(/^\+\+\+\s+/gm);
            return matches ? matches.length : 1;
        }

        return 1;
    }

    private matchesAny(value: string, patterns: string[]): boolean {
        return patterns.some(pattern => value.includes(pattern));
    }
}
