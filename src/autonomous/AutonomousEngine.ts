import * as fs from 'fs';
import * as path from 'path';
import { EventBus } from '../shared/events/EventBus';
import { WorkflowEngine } from '../workflow/WorkflowEngine';
import { ReviewEngine } from '../review/ReviewEngine';
import { DecisionEngine } from './core/DecisionEngine';
import { RetryController } from './core/RetryController';
import { CompletionDetector } from './core/CompletionDetector';
import { LoopState, LoopHistory, LoopMetrics } from './shared/autonomousTypes';
import { NormalizedTask } from '../tasks/shared/taskTypes';

export class AutonomousEngine {
    private readonly workflowEngine: WorkflowEngine;
    private readonly reviewEngine: ReviewEngine;
    private readonly decisionEngine = new DecisionEngine();
    private readonly completionDetector = new CompletionDetector();
    private readonly eventBus = EventBus.getInstance();

    private readonly autonomousDir: string;
    private readonly historyPath: string;
    private readonly metricsPath: string;

    private readonly states = new Map<string, LoopState>();
    private readonly retryControllers = new Map<string, RetryController>();

    constructor(private readonly workspaceRoot: string, private readonly maxIterations = 3) {
        this.autonomousDir = path.join(workspaceRoot, '.aios', 'autonomous');
        this.historyPath = path.join(this.autonomousDir, 'history.json');
        this.metricsPath = path.join(this.autonomousDir, 'metrics.json');
        
        this.workflowEngine = new WorkflowEngine(workspaceRoot);
        this.reviewEngine = new ReviewEngine(workspaceRoot);
        this.ensureDirExists();
    }

    private ensureDirExists() {
        if (!fs.existsSync(this.autonomousDir)) {
            fs.mkdirSync(this.autonomousDir, { recursive: true });
        }
    }

    /**
     * Otonom geliştirme döngüsünü başlatır.
     */
    public async run(task: NormalizedTask): Promise<boolean> {
        const runId = `run_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        const state: LoopState = {
            runId,
            taskId: task.id,
            status: 'running',
            iteration: 0,
            maxIterations: this.maxIterations,
            errors: []
        };
        this.states.set(runId, state);

        const retryController = new RetryController(this.maxIterations);
        this.retryControllers.set(runId, retryController);

        this.eventBus.emit('DevelopmentStarted', { taskId: task.id });

        let templateName = 'Feature Development';
        if (task.category === 'bug') templateName = 'Bug Fix';
        else if (task.category === 'refactor') templateName = 'Refactor';
        else if (task.category === 'docs') templateName = 'Documentation';

        const startedAt = Date.now();

        while (retryController.canRetry()) {
            const iter = retryController.increment();
            state.iteration = iter;

            this.eventBus.emit('DevelopmentIterationStarted', { taskId: task.id, iteration: iter });

            // 1. İş akışını çalıştır (Workflow Engine)
            const workflowId = `wf_${runId}_${iter}`;
            state.currentWorkflowId = workflowId;
            const wfSuccess = await this.workflowEngine.runWorkflow(templateName, workflowId);

            if (!wfSuccess) {
                state.errors.push(`Iteration ${iter}: Workflow failed.`);
            }

            // 2. Kod inceleme yap (Review Engine)
            const filePath = task.metadata?.filePath || 'src/main.ts';
            const reviewResult = await this.reviewEngine.review([filePath]);
            
            const score = reviewResult.score;
            state.score = score;
            
            const findings = reviewResult.results.flatMap(r => r.issues);

            this.eventBus.emit('DevelopmentIterationCompleted', { taskId: task.id, iteration: iter, score });

            // İptal edilip edilmediğini kontrol et
            if (state.status === 'cancelled') {
                this.finalizeRun(runId, startedAt);
                return false;
            }

            // 3. Tamamlanma durumunu denetle
            if (this.completionDetector.isCompleted(score, findings)) {
                state.status = 'completed';
                this.eventBus.emit('DevelopmentCompleted', { taskId: task.id, score });
                this.finalizeRun(runId, startedAt);
                return true;
            }

            // 4. Hata Analizi ve Yeniden Deneme (Decision Engine)
            if (retryController.canRetry()) {
                const remediation = this.decisionEngine.analyze(score, findings);
                const reason = remediation.focusedPrompt;
                state.errors.push(`Iteration ${iter} failed review: ${reason}`);
                this.eventBus.emit('DevelopmentRetry', { taskId: task.id, iteration: iter, reason });
            } else {
                state.errors.push(`Iteration ${iter} failed review with score ${score}. Max retries reached.`);
            }
        }

        // Başarısız sonlanma
        state.status = 'failed';
        this.eventBus.emit('DevelopmentFailed', { taskId: task.id, reason: state.errors.join(' | ') });
        this.finalizeRun(runId, startedAt);
        return false;
    }

    /**
     * Başarısız bir otonom loop'u tekrar başlatır.
     */
    public async retry(runId: string): Promise<boolean> {
        const state = this.states.get(runId);
        if (!state || state.status !== 'failed') {
            throw new Error(`Yeniden denenecek başarısız bir otonom döngü bulunamadı.`);
        }
        
        state.status = 'running';
        state.errors = [];
        const ctrl = this.retryControllers.get(runId);
        if (ctrl) ctrl.reset();
        
        const task: NormalizedTask = {
            id: state.taskId,
            title: 'Retry Task',
            description: '',
            category: 'feature',
            sourceType: 'json',
            priority: 'medium',
            status: 'pending',
            dependencies: []
        };
        return this.run(task);
    }

    /**
     * Devam eden otonom döngüyü iptal eder.
     */
    public cancel(runId: string): void {
        const state = this.states.get(runId);
        if (state && state.status === 'running') {
            state.status = 'cancelled';
        }
    }

    /**
     * Belirtilen loop'un anlık durumunu döndürür.
     */
    public getStatus(runId: string): LoopState | undefined {
        return this.states.get(runId);
    }

    /**
     * Kayıtlı tüm geliştirme döngüsü geçmişini döndürür.
     */
    public getHistory(): LoopHistory[] {
        if (!fs.existsSync(this.historyPath)) return [];
        try {
            const data = fs.readFileSync(this.historyPath, 'utf-8');
            return JSON.parse(data) as LoopHistory[];
        } catch {
            return [];
        }
    }

    /**
     * Otonom döngü metriklerini döndürür.
     */
    public getMetrics(): LoopMetrics {
        if (!fs.existsSync(this.metricsPath)) {
            return {
                totalLoops: 0,
                successfulLoops: 0,
                failedLoops: 0,
                totalIterationsRun: 0,
                averageIterationsPerLoop: 0
            };
        }
        try {
            const data = fs.readFileSync(this.metricsPath, 'utf-8');
            return JSON.parse(data) as LoopMetrics;
        } catch {
            return {
                totalLoops: 0,
                successfulLoops: 0,
                failedLoops: 0,
                totalIterationsRun: 0,
                averageIterationsPerLoop: 0
            };
        }
    }

    private finalizeRun(runId: string, startedAt: number) {
        const state = this.states.get(runId)!;
        const historyLog: LoopHistory = {
            runId,
            taskId: state.taskId,
            startedAt,
            completedAt: Date.now(),
            iterationsCount: state.iteration,
            finalScore: state.score,
            status: state.status as any,
            errors: state.errors
        };

        let history = this.getHistory();
        history.push(historyLog);
        fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2), 'utf-8');

        this.updateMetrics(historyLog);
    }

    private updateMetrics(log: LoopHistory) {
        const metrics = this.getMetrics();
        metrics.totalLoops++;
        metrics.totalIterationsRun += log.iterationsCount;

        if (log.status === 'completed') {
            metrics.successfulLoops++;
        } else if (log.status === 'failed') {
            metrics.failedLoops++;
        }

        metrics.averageIterationsPerLoop = metrics.totalLoops > 0 
            ? metrics.totalIterationsRun / metrics.totalLoops
            : 0;

        fs.writeFileSync(this.metricsPath, JSON.stringify(metrics, null, 2), 'utf-8');
    }
}
