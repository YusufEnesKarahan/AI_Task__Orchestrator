import { ProfileReport } from '../shared/systemTypes';

export class SystemProfiler {
    private readonly startTimes = new Map<string, number>();
    private readonly durations: Record<string, number> = {};

    /**
     * Ölçümü başlatır.
     */
    public startMeasure(pipelineName: string): void {
        this.startTimes.set(pipelineName, Date.now());
    }

    /**
     * Ölçümü durdurur ve geçen süreyi (ms) döner.
     */
    public stopMeasure(pipelineName: string): number {
        const startTime = this.startTimes.get(pipelineName);
        if (!startTime) return 0;
        const duration = Date.now() - startTime;
        this.durations[pipelineName] = duration;
        this.startTimes.delete(pipelineName);
        return duration;
    }

    /**
     * Profiler raporunu hazırlar.
     */
    public report(): ProfileReport {
        const pipelineEntries = Object.entries(this.durations);
        const slowestPipelines = [...pipelineEntries]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(e => e[0]);

        const averageExecutionTime = pipelineEntries.length > 0
            ? pipelineEntries.reduce((sum, e) => sum + e[1], 0) / pipelineEntries.length
            : 0;

        return {
            durations: { ...this.durations },
            slowestPipelines,
            averageExecutionTime
        };
    }
}
