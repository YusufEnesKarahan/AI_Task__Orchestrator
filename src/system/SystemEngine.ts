import * as fs from 'fs';
import * as path from 'path';
import { EventBus } from '../shared/events/EventBus';
import { SystemProfiler } from './core/SystemProfiler';
import { MemoryMonitor } from './core/MemoryMonitor';
import { CacheManager } from './core/CacheManager';
import { TelemetryManager } from './core/TelemetryManager';
import { HealthMonitor } from './core/HealthMonitor';
import { RecoveryManager } from './core/RecoveryManager';
import { ConfigurationValidator } from './core/ConfigurationValidator';
import { BenchmarkRunner } from './core/BenchmarkRunner';
import { ProfileReport, MemoryReport, HealthStatus, RecoveryReport, BenchmarkResult, SystemMetrics as ISystemMetrics } from './shared/systemTypes';

export class SystemEngine {
    private readonly profiler = new SystemProfiler();
    private readonly memoryMonitor = new MemoryMonitor();
    private readonly cacheManager = new CacheManager();
    private readonly telemetryManager = new TelemetryManager();
    private readonly healthMonitor: HealthMonitor;
    private readonly recoveryManager: RecoveryManager;
    private readonly configValidator = new ConfigurationValidator();
    private readonly benchmarkRunner = new BenchmarkRunner();
    private readonly eventBus = EventBus.getInstance();

    private readonly systemDir: string;
    private readonly metricsPath: string;

    constructor(private readonly workspaceRoot: string) {
        this.systemDir = path.join(workspaceRoot, '.aios', 'system');
        this.metricsPath = path.join(this.systemDir, 'metrics.json');
        
        this.healthMonitor = new HealthMonitor(workspaceRoot);
        this.recoveryManager = new RecoveryManager(workspaceRoot);
        this.ensureDirExists();
    }

    private ensureDirExists() {
        if (!fs.existsSync(this.systemDir)) {
            fs.mkdirSync(this.systemDir, { recursive: true });
        }
    }

    public getProfiler(): SystemProfiler {
        return this.profiler;
    }

    public getCacheManager(): CacheManager {
        return this.cacheManager;
    }

    public getTelemetryManager(): TelemetryManager {
        return this.telemetryManager;
    }

    /**
     * Profiler sürelerini okur, ProfilingCompleted olayını fırlatır.
     */
    public profile(): ProfileReport {
        const report = this.profiler.report();
        this.eventBus.emit('ProfilingCompleted', {
            durationMs: report.averageExecutionTime,
            slowestPipelines: report.slowestPipelines
        });
        this.updateMetrics('totalProfilesRun');
        return report;
    }

    /**
     * Bellek kullanımını okur ve raporlar.
     */
    public checkMemory(): MemoryReport {
        return this.memoryMonitor.checkMemory();
    }

    /**
     * Sistem bileşenlerinin sağlık durumunu denetler ve SystemHealthChecked olayını fırlatır.
     */
    public async checkHealth(): Promise<HealthStatus> {
        const health = this.healthMonitor.checkHealth();
        this.eventBus.emit('SystemHealthChecked', {
            status: health.status,
            checksCount: Object.keys(health.details).length
        });

        if (health.status === 'healthy') {
            this.updateMetrics('healthChecksPassed');
        } else {
            this.updateMetrics('healthChecksFailed');
        }

        return health;
    }

    /**
     * Dosya geçmişini ve yarıda kalan iş akışlarını kurtarır.
     */
    public async recover(target: string): Promise<RecoveryReport> {
        return this.recoveryManager.recover(target);
    }

    /**
     * Yapılandırma ayarlarını doğrular.
     */
    public validate(config: any): boolean {
        return this.configValidator.validate(config);
    }

    /**
     * Performans yükü benchmark testlerini çalıştırır.
     */
    public async benchmark(benchmarkName: string): Promise<BenchmarkResult> {
        const result = await this.benchmarkRunner.runBenchmark(benchmarkName);
        this.updateMetrics('totalBenchmarksRun');
        return result;
    }

    /**
     * Sistem hardening metriklerini döner.
     */
    public getMetrics(): ISystemMetrics {
        if (!fs.existsSync(this.metricsPath)) {
            return {
                totalProfilesRun: 0,
                totalBenchmarksRun: 0,
                healthChecksPassed: 0,
                healthChecksFailed: 0,
                cacheHits: 0,
                cacheMisses: 0
            };
        }
        try {
            const data = fs.readFileSync(this.metricsPath, 'utf-8');
            return JSON.parse(data) as ISystemMetrics;
        } catch {
            return {
                totalProfilesRun: 0,
                totalBenchmarksRun: 0,
                healthChecksPassed: 0,
                healthChecksFailed: 0,
                cacheHits: 0,
                cacheMisses: 0
            };
        }
    }

    private updateMetrics(field: keyof ISystemMetrics) {
        const metrics = this.getMetrics();
        metrics[field]++;
        fs.writeFileSync(this.metricsPath, JSON.stringify(metrics, null, 2), 'utf-8');
    }
}
