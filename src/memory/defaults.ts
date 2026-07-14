import {
    DecisionMemoryDocument,
    JournalMemoryDocument,
    MemoryIndexDocument,
    StaticMemory,
    StaticMemoryDocument,
    WorkingMemory,
    WorkingMemoryDocument
} from './types';

export const MEMORY_SCHEMA_VERSION = 1;

export const MEMORY_FILE_NAMES = {
    static: 'memory.json',
    working: 'working-memory.json',
    decision: 'decisions.json',
    journal: 'journal.json',
    index: 'memory-index.json'
} as const;

export function createEmptyStaticMemory(): StaticMemory {
    return {
        technologies: [],
        folderStructure: [],
        modules: [],
        codingRules: []
    };
}

export function createEmptyWorkingMemory(): WorkingMemory {
    return {
        recentChanges: [],
        modifiedFiles: [],
        pendingTasks: [],
        openProblems: []
    };
}

export function createStaticMemoryDocument(now = Date.now()): StaticMemoryDocument {
    return {
        schemaVersion: MEMORY_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        staticMemory: createEmptyStaticMemory(),
        longTermMemory: {
            userPreferences: [],
            technicalDebt: [],
            completedWork: [],
            sprintHistory: [],
            learnedPatterns: []
        }
    };
}

export function createWorkingMemoryDocument(now = Date.now()): WorkingMemoryDocument {
    return {
        schemaVersion: MEMORY_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        workingMemory: createEmptyWorkingMemory()
    };
}

export function createDecisionMemoryDocument(now = Date.now()): DecisionMemoryDocument {
    return {
        schemaVersion: MEMORY_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        decisions: []
    };
}

export function createJournalMemoryDocument(now = Date.now()): JournalMemoryDocument {
    return {
        schemaVersion: MEMORY_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        entries: []
    };
}

export function createMemoryIndexDocument(now = Date.now()): MemoryIndexDocument {
    return {
        schemaVersion: MEMORY_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        files: {
            static: MEMORY_FILE_NAMES.static,
            working: MEMORY_FILE_NAMES.working,
            longTerm: MEMORY_FILE_NAMES.static,
            decision: MEMORY_FILE_NAMES.decision,
            journal: MEMORY_FILE_NAMES.journal
        },
        counts: {
            static: 0,
            working: 0,
            longTerm: 0,
            decision: 0,
            journal: 0
        },
        entries: []
    };
}
