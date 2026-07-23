import { EventBus } from '../../shared/events/EventBus';
import { ExecutionEngine } from '../../execution/ExecutionEngine';
import { ActionEngine } from '../../actions/ActionEngine';
import { ReviewEngine } from '../../review/ReviewEngine';
import { WorkspaceSnapshot } from '../../actions/core/WorkspaceSnapshot';
import { RollbackManager } from '../../actions/core/RollbackManager';
import { AgentRegistry } from '../../agents/core/AgentRegistry';
import { WorkflowDefinition, WorkflowState, WorkflowStep } from '../shared/workflowTypes';

export class WorkflowRunner {
    private readonly eventBus = EventBus.getInstance();
    private readonly executionEngine: ExecutionEngine;
    private readonly actionEngine: ActionEngine;
    private readonly reviewEngine: ReviewEngine;
    private readonly rollbackManager = new RollbackManager();

    private readonly snapshots: WorkspaceSnapshot[] = [];
    private state: WorkflowState;
    private isCancelled = false;

    constructor(
        private readonly workspaceRoot: string,
        private readonly definition: WorkflowDefinition,
        workflowId?: string
    ) {
        this.executionEngine = new ExecutionEngine(workspaceRoot);
        this.actionEngine = new ActionEngine(workspaceRoot);
        this.reviewEngine = new ReviewEngine(workspaceRoot);

        this.state = {
            workflowId: workflowId || `wf_${Date.now()}`,
            templateName: definition.name,
            status: 'pending',
            currentStepIndex: 0,
            stepResults: {},
            variables: {
                changedFiles: []
            }
        };
    }

    public getState(): WorkflowState {
        return this.state;
    }

    public cancel(): void {
        this.isCancelled = true;
        this.state.status = 'cancelled';
    }

    /**
     * İş akışını baştan sona sırayla yürütür.
     */
    public async run(): Promise<boolean> {
        this.state.status = 'running';
        const startedAt = Date.now();
        this.eventBus.emit('WorkflowStarted', { workflowId: this.state.workflowId, template: this.state.templateName });

        let overallSuccess = true;

        for (let i = 0; i < this.definition.steps.length; i++) {
            if (this.isCancelled) {
                this.state.status = 'cancelled';
                overallSuccess = false;
                break;
            }

            this.state.currentStepIndex = i;
            const step = this.definition.steps[i];

            // A. Koşul kontrolü (Conditional Branching)
            if (step.if && !step.if(this.state)) {
                console.log(`[WorkflowRunner] Step "${step.name}" skipped due to condition check.`);
                continue;
            }

            this.eventBus.emit('WorkflowStepStarted', { workflowId: this.state.workflowId, stepName: step.name });

            // B. Adımı çalıştır (retry / rollback politikalarıyla)
            const success = await this.executeStepWithPolicies(step);

            if (!success) {
                if (step.failurePolicy === 'ignore') {
                    console.log(`[WorkflowRunner] Step "${step.name}" failed, but failurePolicy is ignore. Continuing...`);
                    continue;
                }
                
                this.state.status = 'failed';
                overallSuccess = false;
                break;
            }
        }

        if (overallSuccess && !this.isCancelled) {
            this.state.status = 'completed';
        }

        const durationMs = Date.now() - startedAt;
        this.eventBus.emit('WorkflowCompleted', {
            workflowId: this.state.workflowId,
            success: this.state.status === 'completed',
            durationMs
        });

        return this.state.status === 'completed';
    }

    private async executeStepWithPolicies(step: WorkflowStep): Promise<boolean> {
        const maxRetries = step.maxRetries || 0;
        let attempt = 0;
        let success = false;
        let lastError = '';

        while (attempt <= maxRetries && !success) {
            if (attempt > 0) {
                console.log(`[WorkflowRunner] Retrying step "${step.name}" (Attempt ${attempt}/${maxRetries})...`);
            }

            try {
                const res = await this.runStepImplementation(step);
                if (res.success) {
                    success = true;
                    this.state.stepResults[step.name] = res;
                    this.eventBus.emit('WorkflowStepCompleted', { 
                        workflowId: this.state.workflowId, 
                        stepName: step.name, 
                        result: res 
                    });
                } else {
                    lastError = res.error || 'Adım başarısız oldu.';
                    attempt++;
                }
            } catch (err: any) {
                lastError = err?.message || String(err);
                attempt++;
            }
        }

        if (!success) {
            this.eventBus.emit('WorkflowStepFailed', { 
                workflowId: this.state.workflowId, 
                stepName: step.name, 
                error: lastError 
            });

            // Hata politikası Rollback ise, şimdiye kadar alınmış tüm snapshot'ları geri yükle
            if (step.failurePolicy === 'rollback') {
                console.log(`[WorkflowRunner] Rollback policy triggered for failed step "${step.name}".`);
                for (let j = this.snapshots.length - 1; j >= 0; j--) {
                    try {
                        await this.rollbackManager.rollback(this.snapshots[j]);
                    } catch (rollbackErr) {
                        console.error('[WorkflowRunner] Rollback error:', rollbackErr);
                    }
                }
            }
        }

        return success;
    }

    private async runStepImplementation(step: WorkflowStep): Promise<{ success: boolean; data?: any; error?: string }> {
        const p = step.payload;

        switch (step.type) {
            case 'execution': {
                // Eğer explicit agentId tanımlıysa doğrudan o ajanı çöz ve çalıştır
                if (p.agentId) {
                    const agent = AgentRegistry.getInstance().getAgent(p.agentId);
                    if (agent) {
                        const res = await agent.run({ taskDescription: p.taskDescription || '', inputs: {} });
                        return { success: res.success !== false, data: res };
                    }
                }

                // Normal execution flow
                let result;
                if (Array.isArray(p)) {
                    result = await this.executionEngine.executePipeline(p);
                } else {
                    result = await this.executionEngine.execute(p.taskDescription || 'Görevi çalıştır');
                }
                return { success: result.success, data: result };
            }

            case 'action': {
                // Dosya değişikliklerini yedeklemek için snapshot al
                const snapshot = new WorkspaceSnapshot(this.workspaceRoot);
                const batchActions = Array.isArray(p) ? p : [p];
                snapshot.takeSnapshot(batchActions);
                this.snapshots.push(snapshot);

                // Dosya Sistemi / Komut Eylemleri (ActionEngine)
                let result;
                if (Array.isArray(p)) {
                    result = await this.actionEngine.executeBatch(p);
                } else {
                    result = await this.actionEngine.executeAction(p);
                    result = { success: result.success, results: [result] } as any; // normalize
                }

                // Değiştirilen dosyaları state variables içine kaydet ki Review adımı okuyabilsin
                if (result.success) {
                    const paths: string[] = [];
                    for (const action of batchActions) {
                        const targetPath = action.payload?.path || action.payload?.filePath || action.payload?.from || action.payload?.to;
                        if (targetPath) paths.push(targetPath);
                    }
                    this.state.variables.changedFiles = [...this.state.variables.changedFiles, ...paths];
                }

                return { success: result.success, data: result, error: (result as any).rollbackError };
            }

            case 'review': {
                // Kod / Mimari Değerlendirmesi (ReviewEngine)
                const changedFiles = this.state.variables.changedFiles.length > 0 
                    ? this.state.variables.changedFiles 
                    : ['src/extension.ts']; // fallback

                const result = await this.reviewEngine.reviewBatch(changedFiles, p);
                return { success: result.passed, data: result, error: `Review failed with score: ${result.score}` };
            }

            default:
                throw new Error(`Bilinmeyen iş akışı adım tipi: ${step.type}`);
        }
    }
}
