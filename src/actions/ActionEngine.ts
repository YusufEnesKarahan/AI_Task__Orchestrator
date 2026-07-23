import * as fs from 'fs';
import * as path from 'path';
import { EventBus } from '../shared/events/EventBus';
import { ActionValidator } from './core/ActionValidator';
import { ActionExecutor } from './core/ActionExecutor';
import { WorkspaceSnapshot } from './core/WorkspaceSnapshot';
import { RollbackManager } from './core/RollbackManager';
import { ActionDefinition, ActionResult, TransactionResult } from './shared/actionTypes';

export class ActionEngine {
    private readonly validator: ActionValidator;
    private readonly executor: ActionExecutor;
    private readonly rollbackManager = new RollbackManager();
    private readonly eventBus = EventBus.getInstance();

    private readonly actionsDir: string;
    private readonly historyPath: string;

    constructor(private readonly workspaceRoot: string) {
        this.validator = new ActionValidator(workspaceRoot);
        this.executor = new ActionExecutor(workspaceRoot);
        
        this.actionsDir = path.join(workspaceRoot, '.aios', 'actions');
        this.historyPath = path.join(this.actionsDir, 'action-history.json');
        this.ensureDirExists();
    }

    private ensureDirExists() {
        if (!fs.existsSync(this.actionsDir)) {
            fs.mkdirSync(this.actionsDir, { recursive: true });
        }
    }

    /**
     * Tekil bir eylemi işlem (transaction) korumasıyla çalıştırır.
     */
    public async executeAction(action: ActionDefinition): Promise<ActionResult> {
        const batchRes = await this.executeBatch([action]);
        return batchRes.results[0] || {
            success: false,
            error: 'Eylem çalıştırılamadı.',
            executedAt: Date.now()
        };
    }

    /**
     * Eylem kümesini işlem (transaction) mantığıyla yürütür. 
     * Herhangi biri hata alırsa tümünü geri alır (Rollback).
     */
    public async executeBatch(actions: ActionDefinition[]): Promise<TransactionResult> {
        const transactionId = `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.eventBus.emit('TransactionStarted', { transactionId, batchSize: actions.length });

        // 1. Doğrulama yap
        for (const action of actions) {
            const validation = this.validator.validate(action);
            if (!validation.valid) {
                const errorMsg = `Doğrulama hatası: ${validation.errors.join(', ')}`;
                return {
                    transactionId,
                    success: false,
                    results: [],
                    rolledBack: false,
                    rollbackError: errorMsg
                };
            }
        }

        // 2. Orijinal dosyaların yedeğini (Workspace Snapshot) al
        const snapshot = new WorkspaceSnapshot(this.workspaceRoot);
        snapshot.takeSnapshot(actions);

        const results: ActionResult[] = [];
        let success = true;
        let errorReason = '';

        // 3. Eylemleri sırayla çalıştır
        for (const action of actions) {
            this.eventBus.emit('ActionStarted', { transactionId, action });
            try {
                const res = await this.executor.execute(action);
                results.push(res);

                if (res.success) {
                    this.eventBus.emit('ActionCompleted', { transactionId, action, result: res });
                } else {
                    success = false;
                    errorReason = res.error || 'Bilinmeyen hata';
                    this.eventBus.emit('ActionFailed', { transactionId, action, error: errorReason });
                    break;
                }
            } catch (err: any) {
                success = false;
                errorReason = err?.message || String(err);
                results.push({
                    success: false,
                    error: errorReason,
                    executedAt: Date.now()
                });
                this.eventBus.emit('ActionFailed', { transactionId, action, error: errorReason });
                break;
            }
        }

        let rolledBack = false;
        let rollbackError: string | undefined;

        // 4. Hata durumunda Rollback yap
        if (!success) {
            this.eventBus.emit('TransactionRolledBack', { transactionId, reason: errorReason });
            try {
                await this.rollbackManager.rollback(snapshot);
                rolledBack = true;
            } catch (rErr: any) {
                rollbackError = rErr?.message || String(rErr);
            }
        }

        const txResult: TransactionResult = {
            transactionId,
            success,
            results,
            rolledBack,
            rollbackError
        };

        // 5. Kayıtları diske yaz ve olay fırlat
        this.saveTransaction(txResult);
        this.eventBus.emit('TransactionCompleted', { transactionId, success });

        return txResult;
    }

    /**
     * Eylem parametrelerini doğrular.
     */
    public validate(action: ActionDefinition): { valid: boolean; errors: string[] } {
        return this.validator.validate(action);
    }

    /**
     * Harici olarak snapshot geri yüklemesi tetikler.
     */
    public async rollback(snapshot: WorkspaceSnapshot): Promise<void> {
        return this.rollbackManager.rollback(snapshot);
    }

    /**
     * Yürütme geçmişini okur.
     */
    public getHistory(): TransactionResult[] {
        if (!fs.existsSync(this.historyPath)) return [];
        try {
            const data = fs.readFileSync(this.historyPath, 'utf-8');
            return JSON.parse(data) as TransactionResult[];
        } catch {
            return [];
        }
    }

    private saveTransaction(result: TransactionResult) {
        const filePath = path.join(this.actionsDir, `${result.transactionId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');

        // Geçmiş özet listesini güncelle
        let history = this.getHistory();
        history.push(result);

        if (history.length > 100) {
            history.shift();
        }

        fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2), 'utf-8');
    }
}
