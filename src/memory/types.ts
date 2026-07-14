export type MemoryLayer = 'static' | 'working' | 'longTerm' | 'decision' | 'journal';
export type DecisionStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded';
export type MemorySource = 'user' | 'ai' | 'system';

export interface MemoryDocumentBase {
    schemaVersion: number;
    createdAt: number;
    updatedAt: number;
}

export interface StaticMemory {
    project?: {
        name?: string;
        description?: string;
        type?: string;
    };
    architecture?: {
        type?: string;
        confidence?: number;
        notes?: string[];
    };
    technologies: string[];
    folderStructure: string[];
    database?: {
        type?: string;
        tables?: string[];
    };
    modules: string[];
    codingRules: string[];
}

export interface LongTermMemory {
    userPreferences: string[];
    technicalDebt: string[];
    completedWork: string[];
    sprintHistory: string[];
    learnedPatterns: string[];
}

export interface StaticMemoryDocument extends MemoryDocumentBase {
    staticMemory: StaticMemory;
    longTermMemory: LongTermMemory;
}

export interface WorkingMemory {
    currentSprint?: string;
    currentGoal?: string;
    currentTask?: string;
    currentBranch?: string;
    recentChanges: string[];
    modifiedFiles: string[];
    pendingTasks: string[];
    openProblems: string[];
    lastOperation?: string;
}

export interface WorkingMemoryDocument extends MemoryDocumentBase {
    workingMemory: WorkingMemory;
}

export interface DecisionRecord {
    id: string;
    timestamp: number;
    title: string;
    reason: string;
    status: DecisionStatus;
    source: MemorySource;
    context?: string;
    tags: string[];
    relatedFiles: string[];
}

export interface DecisionMemoryDocument extends MemoryDocumentBase {
    decisions: DecisionRecord[];
}

export interface JournalEntry {
    id: string;
    timestamp: number;
    summary: string;
    why: string;
    changedFiles: string[];
    completed: string[];
    nextStep?: string;
    tags: string[];
}

export interface JournalMemoryDocument extends MemoryDocumentBase {
    entries: JournalEntry[];
}

export interface MemoryIndexEntry {
    layer: MemoryLayer;
    file: string;
    key: string;
    title: string;
    updatedAt: number;
    tags: string[];
}

export interface MemoryIndexDocument extends MemoryDocumentBase {
    files: Record<MemoryLayer, string>;
    counts: Record<MemoryLayer, number>;
    entries: MemoryIndexEntry[];
}

export interface MemorySnapshot {
    static: StaticMemoryDocument;
    working: WorkingMemoryDocument;
    decisions: DecisionMemoryDocument;
    journal: JournalMemoryDocument;
    index: MemoryIndexDocument;
}

export interface SearchMemoryOptions {
    layers?: MemoryLayer[];
    limit?: number;
}

export interface MemorySearchResult {
    layer: MemoryLayer;
    file: string;
    key: string;
    title: string;
    score: number;
    excerpt: string;
    tags: string[];
    updatedAt: number;
}

export interface AddDecisionInput {
    title: string;
    reason: string;
    status?: DecisionStatus;
    source: MemorySource;
    context?: string;
    tags?: string[];
    relatedFiles?: string[];
}

export interface AddJournalEntryInput {
    summary: string;
    why: string;
    changedFiles?: string[];
    completed?: string[];
    nextStep?: string;
    tags?: string[];
}

export interface UpdateStaticMemoryInput {
    project?: StaticMemory['project'];
    architecture?: StaticMemory['architecture'];
    technologies?: string[];
    folderStructure?: string[];
    database?: StaticMemory['database'];
    modules?: string[];
    codingRules?: string[];
    longTermMemory?: Partial<LongTermMemory>;
}

export type UpdateWorkingMemoryInput = Partial<WorkingMemory>;
