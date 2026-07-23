import * as fs from 'fs';
import * as path from 'path';
import { WorkflowRegistry } from './core/WorkflowRegistry';
import { WorkflowRunner } from './core/WorkflowRunner';
import { WorkflowMetrics } from './core/WorkflowMetrics';
import { WorkflowRunLog, WorkflowState, WorkflowMetrics as IWorkflowMetrics } from './shared/workflowTypes';

export class WorkflowEngine {
    private readonly registry = WorkflowRegistry.getInstance();
    private readonly activeRunners = new Map<string, WorkflowRunner>();
    private readonly metricsTracker: WorkflowMetrics;

    private readonly workflowDir: string;
    private readonly historyPath: string;

    constructor(private readonly workspaceRoot: string) {
        this.workflowDir = path.join(workspaceRoot, '.aios', 'workflow');
        this.historyPath = path.join(this.workflowDir, 'workflow-history.json');
        
        this.ensureDirExists();
        this.metricsTracker = new WorkflowMetrics(path.join(this.workflowDir, 'workflow-metrics.json'));
    }

    private ensureDirExists() {
        if (!fs.existsSync(this.workflowDir)) {
            fs.mkdirSync(this.workflowDir, { recursive: true });
        }
    }

    /**
     * Şablona göre yeni bir iş akışı tetikler.
     */
    public async runWorkflow(templateName: string, workflowId?: string): Promise<boolean> {
        const template = this.registry.getTemplate(templateName);
        if (!template) {
            throw new Error(`İş akışı şablonu bulunamadı: "${templateName}"`);
        }

        const runner = new WorkflowRunner(this.workspaceRoot, template, workflowId);
        const wId = runner.getState().workflowId;
        this.activeRunners.set(wId, runner);

        const startedAt = Date.now();
        const success = await runner.run();
        const completedAt = Date.now();
        const durationMs = completedAt - startedAt;

        const log: WorkflowRunLog = {
            workflowId: wId,
            templateName,
            success,
            startedAt,
            completedAt,
            durationMs,
            state: runner.getState()
        };

        this.saveRunLog(log);
        this.metricsTracker.update(log);
        this.activeRunners.delete(wId);

        return success;
    }

    /**
     * Çalışmakta olan bir iş akışını iptal eder.
     */
    public cancelWorkflow(workflowId: string): void {
        const runner = this.activeRunners.get(workflowId);
        if (runner) {
            runner.cancel();
        }
    }

    /**
     * Başarısız olmuş veya yarıda kalmış bir iş akışını tekrar dener.
     */
    public async retryWorkflow(workflowId: string): Promise<boolean> {
        const history = this.getHistory();
        const runLog = history.find(l => l.workflowId === workflowId);
        if (!runLog) {
            throw new Error(`Tekrar denenecek iş akışı geçmişte bulunamadı: ${workflowId}`);
        }
        return this.runWorkflow(runLog.templateName, workflowId);
    }

    /**
     * İş akışının güncel durumunu döndürür.
     */
    public getStatus(workflowId: string): WorkflowState | undefined {
        const runner = this.activeRunners.get(workflowId);
        if (runner) {
            return runner.getState();
        }
        
        // Aktif değilse geçmişten durumunu getir
        const history = this.getHistory();
        const log = history.find(l => l.workflowId === workflowId);
        return log?.state;
    }

    /**
     * Geçmiş iş akışı kayıtlarını döndürür.
     */
    public getHistory(): WorkflowRunLog[] {
        if (!fs.existsSync(this.historyPath)) return [];
        try {
            const data = fs.readFileSync(this.historyPath, 'utf-8');
            return JSON.parse(data) as WorkflowRunLog[];
        } catch {
            return [];
        }
    }

    /**
     * İş akışı yürütme metriklerini döndürür.
     */
    public getMetrics(): IWorkflowMetrics {
        return this.metricsTracker.getMetrics();
    }

    private saveRunLog(log: WorkflowRunLog) {
        const filePath = path.join(this.workflowDir, `run_${log.workflowId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(log, null, 2), 'utf-8');

        let history = this.getHistory();
        const idx = history.findIndex(l => l.workflowId === log.workflowId);
        if (idx !== -1) {
            history[idx] = log;
        } else {
            history.push(log);
        }

        if (history.length > 100) {
            history.shift();
        }

        fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2), 'utf-8');
    }
}
