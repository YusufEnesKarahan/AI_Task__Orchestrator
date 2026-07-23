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
    AgentRunStarted: { agentId: string; profile: string; input: any };
    AgentRunCompleted: { agentId: string; profile: string; result: any };
    AgentRunFailed: { agentId: string; profile: string; error: string };
    PipelineStarted: { pipelineId: string; steps: string[] };
    PipelineStepCompleted: { pipelineId: string; stepIndex: number; agentId: string; result: any };
    PipelineCompleted: { pipelineId: string; success: boolean; finalData: any };
    ExecutionStarted: { executionId: string; graph: any };
    ExecutionStepStarted: { executionId: string; nodeId: string };
    ExecutionStepCompleted: { executionId: string; nodeId: string; result: any };
    ExecutionStepFailed: { executionId: string; nodeId: string; error: string };
    ExecutionCompleted: { executionId: string; success: boolean; metrics: any };
    ActionStarted: { transactionId: string; action: any };
    ActionCompleted: { transactionId: string; action: any; result: any };
    ActionFailed: { transactionId: string; action: any; error: string };
    TransactionStarted: { transactionId: string; batchSize: number };
    TransactionRolledBack: { transactionId: string; reason: string };
    TransactionCompleted: { transactionId: string; success: boolean };
    CodeReviewStarted: { reviewId: string; targetFiles: string[] };
    CodeReviewStepCompleted: { reviewId: string; reviewer: string; result: any };
    CodeReviewCompleted: { reviewId: string; passed: boolean; score: number };
    WorkflowStarted: { workflowId: string; template: string };
    WorkflowStepStarted: { workflowId: string; stepName: string };
    WorkflowStepCompleted: { workflowId: string; stepName: string; result: any };
    WorkflowStepFailed: { workflowId: string; stepName: string; error: string };
    WorkflowCompleted: { workflowId: string; success: boolean; durationMs: number };
    EditorOpened: { filePath: string };
    SelectionChanged: { text: string; range: any };
    DiagnosticWarningAdded: { filePath: string; message: string };
    BridgeCommandExecuted: { command: string; success: boolean };
    TaskParsed: { source: string; count: number };
    TaskPrioritized: { taskId: string; priority: string };
    TaskDependenciesResolved: { sortedIds: string[] };
    DevelopmentStarted: { taskId: string };
    DevelopmentIterationStarted: { taskId: string; iteration: number };
    DevelopmentIterationCompleted: { taskId: string; iteration: number; score: number };
    DevelopmentRetry: { taskId: string; iteration: number; reason: string };
    DevelopmentCompleted: { taskId: string; score: number };
    DevelopmentFailed: { taskId: string; reason: string };
    RepositoryOpened: { repositoryRoot: string };
    BranchCreated: { branchName: string };
    BranchSwitched: { branchName: string };
    DiffAnalyzed: { changedFilesCount: number };
    CommitGenerated: { message: string };
    CommitCreated: { hash: string; message: string };
    MergeConflictDetected: { filePath: string };
    MCPConnected: { serverUrl: string };
    MCPDisconnected: { serverUrl: string };
    MCPToolDiscovered: { serverUrl: string; toolName: string };
    MCPToolExecuted: { toolName: string; success: boolean };
    MCPResourceRead: { uri: string; success: boolean };
    MCPPromptLoaded: { promptName: string };
    MCPSessionStarted: { sessionId: string };
    MCPSessionClosed: { sessionId: string };
    SystemHealthChecked: { status: 'healthy' | 'unhealthy'; checksCount: number };
    BenchmarkCompleted: { benchmarkName: string; durationMs: number; opsPerSec: number };
    RecoveryStarted: { target: string };
    RecoveryCompleted: { target: string; restoredCount: number };
    ProfilingCompleted: { durationMs: number; slowestPipelines: string[] };
    CacheUpdated: { cacheType: string; keysCount: number };
    RuntimeStarting: { timestamp: number };
    RuntimeReady: { timestamp: number; bootstrapDurationMs: number };
    RuntimeStopping: { timestamp: number };
    RuntimeStopped: { timestamp: number };
    ConfigurationLoaded: { configPath: string };
    ContainerReady: { registeredCount: number };
    BootstrapCompleted: { stepsCompleted: number; durationMs: number };
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
