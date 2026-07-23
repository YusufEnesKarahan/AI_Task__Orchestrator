import { EventBus } from '../../shared/events/EventBus';

export class TelemetryManager {
    private readonly eventBus = EventBus.getInstance();
    private eventCounts: Record<string, number> = {};
    private workflowDurations: number[] = [];
    private readonly unsubscribers: (() => void)[] = [];

    constructor() {
        this.setupSubscriptions();
    }

    private setupSubscriptions() {
        const track = (eventName: string) => {
            return this.eventBus.on(eventName, () => {
                this.eventCounts[eventName] = (this.eventCounts[eventName] || 0) + 1;
            });
        };

        this.unsubscribers.push(
            track('WorkflowStarted'),
            track('WorkflowCompleted'),
            track('CodeReviewStarted'),
            track('CodeReviewCompleted'),
            track('TaskParsed'),
            track('CommitCreated'),
            track('MCPConnected'),
            
            this.eventBus.on('WorkflowCompleted', (payload: any) => {
                if (payload && typeof payload.durationMs === 'number') {
                    this.workflowDurations.push(payload.durationMs);
                }
            })
        );
    }

    /**
     * Güncel telemetri istatistiklerini raporlar.
     */
    public getTelemetryReport(): any {
        const averageWorkflowTime = this.workflowDurations.length > 0
            ? this.workflowDurations.reduce((sum, d) => sum + d, 0) / this.workflowDurations.length
            : 0;

        return {
            eventCounts: { ...this.eventCounts },
            averageWorkflowTime,
            totalWorkflowsRun: this.workflowDurations.length
        };
    }

    public dispose() {
        this.unsubscribers.forEach(unsub => unsub());
    }
}
