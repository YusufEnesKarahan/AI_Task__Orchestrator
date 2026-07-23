import * as fs from 'fs';
import { BridgeMetrics as IBridgeMetrics, BridgeRunLog } from '../shared/bridgeTypes';

export class BridgeMetrics {
    private metrics: IBridgeMetrics = {
        totalEvents: 0,
        activeEditorsOpened: 0,
        commandsExecuted: 0
    };

    constructor(private readonly metricsPath: string) {
        this.load();
    }

    /**
     * Güncel köprü metriklerini döndürür.
     */
    public getMetrics(): IBridgeMetrics {
        return this.metrics;
    }

    /**
     * Köprüdeki olay tetiklemelerine göre metrikleri günceller.
     */
    public update(log: BridgeRunLog): void {
        this.metrics.totalEvents++;

        if (log.eventName === 'EditorOpened') {
            this.metrics.activeEditorsOpened++;
        } else if (log.eventName === 'BridgeCommandExecuted') {
            this.metrics.commandsExecuted++;
        }

        this.save();
    }

    private load() {
        if (!fs.existsSync(this.metricsPath)) return;
        try {
            const data = fs.readFileSync(this.metricsPath, 'utf-8');
            this.metrics = JSON.parse(data) as IBridgeMetrics;
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
