import * as fs from 'fs';
import * as path from 'path';
import { ReasoningTrace } from '../shared/reasoningTypes';

export class ReasoningTraceManager {
    private readonly reasoningDir: string;

    constructor(workspaceRoot: string) {
        this.reasoningDir = path.join(workspaceRoot, '.aios', 'reasoning');
        this.ensureReasoningDirectory();
    }

    private ensureReasoningDirectory() {
        if (!fs.existsSync(this.reasoningDir)) {
            fs.mkdirSync(this.reasoningDir, { recursive: true });
        }
    }

    /**
     * Tekil bir reasoning trace kaydını .aios/reasoning/trace_<id>.json olarak kaydeder.
     */
    public saveTrace(trace: ReasoningTrace): void {
        const filePath = path.join(this.reasoningDir, `trace_${trace.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(trace, null, 2), 'utf-8');

        // Ayrıca son yürütülen planlar listesi için execution-plans.json güncelleyelim (Görev 14 gereksinimi)
        this.updateExecutionPlansList(trace);
    }

    /**
     * Trace kaydını okur.
     */
    public getTrace(id: string): ReasoningTrace | null {
        const filePath = path.join(this.reasoningDir, `trace_${id}.json`);
        if (fs.existsSync(filePath)) {
            try {
                const data = fs.readFileSync(filePath, 'utf-8');
                return JSON.parse(data) as ReasoningTrace;
            } catch (error) {
                console.error(`[ReasoningTraceManager] Error reading trace ${id}:`, error);
            }
        }
        return null;
    }

    /**
     * Tüm trace kayıtlarını listeler.
     */
    public listTraces(): string[] {
        if (!fs.existsSync(this.reasoningDir)) return [];
        return fs.readdirSync(this.reasoningDir)
            .filter(file => file.startsWith('trace_') && file.endsWith('.json'))
            .map(file => file.replace('trace_', '').replace('.json', ''));
    }

    /**
     * execution-plans.json dosyasına yeni trace'i/planı ekler veya günceller.
     */
    private updateExecutionPlansList(trace: ReasoningTrace) {
        const filePath = path.join(this.reasoningDir, 'execution-plans.json');
        let plans: any[] = [];

        if (fs.existsSync(filePath)) {
            try {
                const data = fs.readFileSync(filePath, 'utf-8');
                plans = JSON.parse(data);
            } catch (e) {
                // Ignore corrupt file
            }
        }

        // Son kararı ekle
        plans.push({
            traceId: trace.id,
            timestamp: trace.timestamp,
            input: trace.inputDescription,
            decisions: trace.decisions
        });

        // Maksimum 50 plan tut
        if (plans.length > 50) {
            plans.shift();
        }

        fs.writeFileSync(filePath, JSON.stringify(plans, null, 2), 'utf-8');
    }
}
