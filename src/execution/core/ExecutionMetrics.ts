import * as fs from 'fs';
import * as path from 'path';
import { ExecutionMetrics as MetricsType, ExecutionNode, ExecutionResult } from '../shared/executionTypes';

export class ExecutionMetricsManager {
    private readonly executionDir: string;
    private readonly metricsPath: string;

    constructor(workspaceRoot: string) {
        this.executionDir = path.join(workspaceRoot, '.aios', 'execution');
        this.metricsPath = path.join(this.executionDir, 'execution-metrics.json');
        this.ensureDirExists();
    }

    private ensureDirExists() {
        if (!fs.existsSync(this.executionDir)) {
            fs.mkdirSync(this.executionDir, { recursive: true });
        }
    }

    /**
     * Yürütme tamamlandığında metrikleri hesaplar ve kaydeder.
     */
    public saveExecution(result: ExecutionResult): void {
        const filePath = path.join(this.executionDir, `run_${result.executionId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');

        // Toplu metrik dosyasına da kaydet
        this.appendGlobalMetric(result);
    }

    /**
     * Adımlardan metrik özeti çıkarır.
     */
    public calculateMetrics(nodes: ExecutionNode[], totalDurationMs: number): MetricsType {
        const totalNodes = nodes.length;
        if (totalNodes === 0) {
            return { totalDurationMs: 0, successRate: 0, parallelismFactor: 0, stepDurations: {} };
        }

        const completedCount = nodes.filter(n => n.status === 'completed').length;
        const successRate = Math.round((completedCount / totalNodes) * 100);

        const stepDurations: Record<string, number> = {};
        let totalStepSumMs = 0;

        nodes.forEach(node => {
            const duration = node.durationMs || 0;
            stepDurations[node.id] = duration;
            totalStepSumMs += duration;
        });

        // Parallelism Factor = Adımların toplam süresi / Grafın toplam geçiş süresi
        // Eşzamanlı çalışmada bu oran > 1.0 çıkacaktır.
        const parallelismFactor = totalDurationMs > 0 
            ? Math.round((totalStepSumMs / totalDurationMs) * 100) / 100 
            : 1.0;

        return {
            totalDurationMs,
            successRate,
            parallelismFactor,
            stepDurations
        };
    }

    private appendGlobalMetric(result: ExecutionResult) {
        let history: any[] = [];
        if (fs.existsSync(this.metricsPath)) {
            try {
                const data = fs.readFileSync(this.metricsPath, 'utf-8');
                history = JSON.parse(data);
            } catch (error) {
                // Ignore corrupt metrics file
            }
        }

        history.push({
            executionId: result.executionId,
            timestamp: Date.now(),
            success: result.success,
            totalDurationMs: result.metrics.totalDurationMs,
            successRate: result.metrics.successRate,
            parallelismFactor: result.metrics.parallelismFactor
        });

        // Son 100 yürütme özetini tut
        if (history.length > 100) {
            history.shift();
        }

        fs.writeFileSync(this.metricsPath, JSON.stringify(history, null, 2), 'utf-8');
    }
}
