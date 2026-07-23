import * as fs from 'fs';
import { WorkflowMetrics as IWorkflowMetrics, WorkflowRunLog } from '../shared/workflowTypes';

export class WorkflowMetrics {
    private metrics: IWorkflowMetrics = {
        totalWorkflows: 0,
        passedCount: 0,
        failedCount: 0,
        averageDurationMs: 0
    };

    constructor(private readonly metricsPath: string) {
        this.load();
    }

    /**
     * Güncel iş akışı metriklerini döner.
     */
    public getMetrics(): IWorkflowMetrics {
        return this.metrics;
    }

    /**
     * Yeni bir iş akışı çıktısıyla metrikleri günceller.
     */
    public update(log: WorkflowRunLog): void {
        const total = this.metrics.totalWorkflows;
        const currentSum = this.metrics.averageDurationMs * total;
        const newTotal = total + 1;
        const duration = log.durationMs || 0;
        const newAvg = Math.round((currentSum + duration) / newTotal);

        this.metrics = {
            totalWorkflows: newTotal,
            passedCount: this.metrics.passedCount + (log.success ? 1 : 0),
            failedCount: this.metrics.failedCount + (log.success ? 0 : 1),
            averageDurationMs: newAvg
        };

        this.save();
    }

    private load() {
        if (!fs.existsSync(this.metricsPath)) return;
        try {
            const data = fs.readFileSync(this.metricsPath, 'utf-8');
            this.metrics = JSON.parse(data) as IWorkflowMetrics;
        } catch {
            // ignore
        }
    }

    private save() {
        try {
            fs.writeFileSync(this.metricsPath, JSON.stringify(this.metrics, null, 2), 'utf-8');
        } catch {
            // ignore
        }
    }
}
