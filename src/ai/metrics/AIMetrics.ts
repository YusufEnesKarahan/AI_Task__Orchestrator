import * as fs from 'fs';
import * as path from 'path';

export interface AIMetricRecord {
    modelId: string;
    timestamp: number;
    durationMs: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd?: number;
}

export class AIMetrics {
    private metricsPath: string;

    constructor(workspaceRoot: string) {
        this.metricsPath = path.join(workspaceRoot, '.aios', 'metrics.json');
    }

    public recordUsage(record: AIMetricRecord): void {
        const history = this.loadMetrics();
        history.push(record);
        this.saveMetrics(history);
    }

    public getMetrics(): AIMetricRecord[] {
        return this.loadMetrics();
    }

    public getTotalUsage(): { totalTokens: number; totalCostUsd: number } {
        const metrics = this.loadMetrics();
        return metrics.reduce((acc, curr) => ({
            totalTokens: acc.totalTokens + curr.totalTokens,
            totalCostUsd: acc.totalCostUsd + (curr.estimatedCostUsd || 0)
        }), { totalTokens: 0, totalCostUsd: 0 });
    }

    private loadMetrics(): AIMetricRecord[] {
        if (!fs.existsSync(this.metricsPath)) {
            return [];
        }
        try {
            const data = fs.readFileSync(this.metricsPath, 'utf-8');
            return JSON.parse(data) as AIMetricRecord[];
        } catch (error) {
            console.error('[AIMetrics] Error loading metrics:', error);
            return [];
        }
    }

    private saveMetrics(metrics: AIMetricRecord[]): void {
        const dir = path.dirname(this.metricsPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.metricsPath, JSON.stringify(metrics, null, 2), 'utf-8');
    }
}
