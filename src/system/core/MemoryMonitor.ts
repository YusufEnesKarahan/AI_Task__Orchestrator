import { MemoryReport } from '../shared/systemTypes';

export class MemoryMonitor {
    /**
     * Anlık bellek kullanımını kontrol eder ve raporlar.
     */
    public checkMemory(): MemoryReport {
        const usage = process.memoryUsage();
        
        // 250 MB bellek eşiği
        const threshold = 250 * 1024 * 1024;
        const leakWarning = usage.heapUsed > threshold;

        return {
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            rss: usage.rss,
            leakWarning
        };
    }
}
