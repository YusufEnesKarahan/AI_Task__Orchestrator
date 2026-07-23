export interface ProfileReport {
    durations: Record<string, number>;
    slowestPipelines: string[];
    averageExecutionTime: number;
}

export interface MemoryReport {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    leakWarning: boolean;
}

export interface HealthStatus {
    status: 'healthy' | 'unhealthy';
    details: Record<string, boolean>;
}

export interface RecoveryReport {
    target: string;
    success: boolean;
    restoredCount: number;
}

export interface BenchmarkResult {
    benchmarkName: string;
    durationMs: number;
    opsPerSec: number;
}

export interface SystemMetrics {
    totalProfilesRun: number;
    totalBenchmarksRun: number;
    healthChecksPassed: number;
    healthChecksFailed: number;
    cacheHits: number;
    cacheMisses: number;
}
