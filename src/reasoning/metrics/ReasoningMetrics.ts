import * as fs from 'fs';
import * as path from 'path';
import { ReasoningMetricRecord } from '../shared/reasoningTypes';

export class ReasoningMetrics {
    private readonly metricsPath: string;

    constructor(workspaceRoot: string) {
        this.metricsPath = path.join(workspaceRoot, '.aios', 'reasoning', 'reasoning-metrics.json');
        this.ensureDirExists();
    }

    private ensureDirExists() {
        const dir = path.dirname(this.metricsPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * Reasoning sonucunu metrik kaydı olarak ekler.
     */
    public recordUsage(record: ReasoningMetricRecord): void {
        const history = this.loadMetrics();
        history.push(record);
        this.saveMetrics(history);
    }

    /**
     * Tüm metrik kayıtlarını döndürür.
     */
    public getMetrics(): ReasoningMetricRecord[] {
        return this.loadMetrics();
    }

    /**
     * Genel özet istatistiklerini hesaplar.
     */
    public getSummary(): {
        totalRuns: number;
        cacheHitRate: number;
        avgDurationMs: number;
        avgConfidence: number;
        avgRiskScore: number;
    } {
        const metrics = this.loadMetrics();
        if (metrics.length === 0) {
            return {
                totalRuns: 0,
                cacheHitRate: 0,
                avgDurationMs: 0,
                avgConfidence: 0,
                avgRiskScore: 0
            };
        }

        const totalRuns = metrics.length;
        const cacheHits = metrics.filter(m => m.fromCache).length;
        const sumDuration = metrics.reduce((acc, curr) => acc + curr.reasoningTimeMs, 0);
        const sumConfidence = metrics.reduce((acc, curr) => acc + curr.confidence, 0);
        const sumRisk = metrics.reduce((acc, curr) => acc + curr.riskScore, 0);

        return {
            totalRuns,
            cacheHitRate: Math.round((cacheHits / totalRuns) * 100) / 100,
            avgDurationMs: Math.round(sumDuration / totalRuns),
            avgConfidence: Math.round((sumConfidence / totalRuns) * 100) / 100,
            avgRiskScore: Math.round((sumRisk / totalRuns) * 100) / 100
        };
    }

    private loadMetrics(): ReasoningMetricRecord[] {
        if (!fs.existsSync(this.metricsPath)) {
            return [];
        }
        try {
            const data = fs.readFileSync(this.metricsPath, 'utf-8');
            return JSON.parse(data) as ReasoningMetricRecord[];
        } catch (error) {
            console.error('[ReasoningMetrics] Error loading metrics:', error);
            return [];
        }
    }

    private saveMetrics(metrics: ReasoningMetricRecord[]): void {
        fs.writeFileSync(this.metricsPath, JSON.stringify(metrics, null, 2), 'utf-8');
    }
}
