import { BenchmarkResult } from '../shared/systemTypes';
import { EventBus } from '../../shared/events/EventBus';

export class BenchmarkRunner {
    private readonly eventBus = EventBus.getInstance();

    /**
     * Belirtilen benchmark testini (örn. büyük repository, çoklu görev, paralel akış) çalıştırır.
     */
    public async runBenchmark(benchmarkName: string): Promise<BenchmarkResult> {
        const start = Date.now();
        
        // İşlem yükünü simüle etmek için matematik döngüsü kuralım
        let iterations = 100000;
        if (benchmarkName === 'large_repository') {
            iterations = 200000;
        } else if (benchmarkName === 'parallel_workflow') {
            iterations = 150000;
        }

        let acc = 0;
        for (let i = 0; i < iterations; i++) {
            acc += Math.sin(i) * Math.cos(i);
        }

        const durationMs = Date.now() - start;
        const opsPerSec = Math.round((iterations / (durationMs || 1)) * 1000);

        const result: BenchmarkResult = {
            benchmarkName,
            durationMs,
            opsPerSec
        };

        this.eventBus.emit('BenchmarkCompleted', result);

        return result;
    }
}
