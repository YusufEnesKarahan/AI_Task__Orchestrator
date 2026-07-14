import { EventEmitter } from 'events';

export interface EventPayloads {
    WorkspaceLoaded: { workspaceRoot: string };
    ProjectScanned: { result: any };
    TaskCreated: { task: any };
    TaskUpdated: { taskId: string; status: string };
    PromptGenerated: { prompt: any };
    PromptEdited: { promptId: string; content: string };
    PromptExecuted: { promptId: string; success: boolean };
    ReviewCompleted: { taskId: string; result: any };
    MemoryLoaded: { workspaceRoot: string; index: any };
    MemoryUpdated: { key: string; value: any; layer?: string; file?: string };
    DecisionAdded: { workspaceRoot: string; decision: any };
    JournalAdded: { workspaceRoot: string; entry: any };
    WorkingMemoryUpdated: { workspaceRoot: string; workingMemory: any };
    MemoryCleared: { workspaceRoot: string };
    RoadmapUpdated: { roadmap: any };
    LogAdded: { log: any };
    [key: string]: any;
}

export class EventBus {
    private static instance: EventBus;
    private readonly emitter = new EventEmitter();

    private constructor() {}

    public static getInstance(): EventBus {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }

    public emit<K extends keyof EventPayloads>(event: K, payload: EventPayloads[K]): void {
        this.emitter.emit(event as string, payload);
    }

    public on<K extends keyof EventPayloads>(event: K, listener: (payload: EventPayloads[K]) => void): () => void {
        this.emitter.on(event as string, listener);
        return () => {
            this.emitter.off(event as string, listener);
        };
    }
}
