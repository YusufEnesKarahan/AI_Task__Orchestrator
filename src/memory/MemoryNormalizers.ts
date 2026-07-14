import {
    createDecisionMemoryDocument,
    createJournalMemoryDocument,
    createMemoryIndexDocument,
    createStaticMemoryDocument,
    createWorkingMemoryDocument,
    MEMORY_SCHEMA_VERSION
} from './defaults';
import {
    DecisionMemoryDocument,
    JournalMemoryDocument,
    MemoryIndexDocument,
    StaticMemoryDocument,
    WorkingMemoryDocument
} from './types';

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
}

export function normalizeStaticMemoryDocument(
    value: Partial<StaticMemoryDocument> | undefined,
    now: number
): StaticMemoryDocument {
    const fallback = createStaticMemoryDocument(now);
    const root = asRecord(value);
    const staticMemory = asRecord(root.staticMemory);
    const longTermMemory = asRecord(root.longTermMemory);
    const project = asRecord(staticMemory.project);
    const architecture = asRecord(staticMemory.architecture);
    const database = asRecord(staticMemory.database);

    return {
        schemaVersion: MEMORY_SCHEMA_VERSION,
        createdAt: asNumber(root.createdAt, fallback.createdAt),
        updatedAt: asNumber(root.updatedAt, fallback.updatedAt),
        staticMemory: {
            project: Object.keys(project).length
                ? {
                      name: asString(project.name),
                      description: asString(project.description),
                      type: asString(project.type)
                  }
                : undefined,
            architecture: Object.keys(architecture).length
                ? {
                      type: asString(architecture.type),
                      confidence: asNumber(architecture.confidence, 0),
                      notes: asStringArray(architecture.notes)
                  }
                : undefined,
            technologies: asStringArray(staticMemory.technologies),
            folderStructure: asStringArray(staticMemory.folderStructure),
            database: Object.keys(database).length
                ? {
                      type: asString(database.type),
                      tables: asStringArray(database.tables)
                  }
                : undefined,
            modules: asStringArray(staticMemory.modules),
            codingRules: asStringArray(staticMemory.codingRules)
        },
        longTermMemory: {
            userPreferences: asStringArray(longTermMemory.userPreferences),
            technicalDebt: asStringArray(longTermMemory.technicalDebt),
            completedWork: asStringArray(longTermMemory.completedWork),
            sprintHistory: asStringArray(longTermMemory.sprintHistory),
            learnedPatterns: asStringArray(longTermMemory.learnedPatterns)
        }
    };
}

export function normalizeWorkingMemoryDocument(
    value: Partial<WorkingMemoryDocument> | undefined,
    now: number
): WorkingMemoryDocument {
    const fallback = createWorkingMemoryDocument(now);
    const root = asRecord(value);
    const workingMemory = asRecord(root.workingMemory);

    return {
        schemaVersion: MEMORY_SCHEMA_VERSION,
        createdAt: asNumber(root.createdAt, fallback.createdAt),
        updatedAt: asNumber(root.updatedAt, fallback.updatedAt),
        workingMemory: {
            currentSprint: asString(workingMemory.currentSprint),
            currentGoal: asString(workingMemory.currentGoal),
            currentTask: asString(workingMemory.currentTask),
            currentBranch: asString(workingMemory.currentBranch),
            recentChanges: asStringArray(workingMemory.recentChanges),
            modifiedFiles: asStringArray(workingMemory.modifiedFiles),
            pendingTasks: asStringArray(workingMemory.pendingTasks),
            openProblems: asStringArray(workingMemory.openProblems),
            lastOperation: asString(workingMemory.lastOperation)
        }
    };
}

export function normalizeDecisionMemoryDocument(
    value: Partial<DecisionMemoryDocument> | undefined,
    now: number
): DecisionMemoryDocument {
    const fallback = createDecisionMemoryDocument(now);
    const root = asRecord(value);
    const decisions = Array.isArray(root.decisions) ? root.decisions : [];

    return {
        schemaVersion: MEMORY_SCHEMA_VERSION,
        createdAt: asNumber(root.createdAt, fallback.createdAt),
        updatedAt: asNumber(root.updatedAt, fallback.updatedAt),
        decisions: decisions.map((item, index) => {
            const decision = asRecord(item);
            return {
                id: asString(decision.id) || `decision_${now}_${index}`,
                timestamp: asNumber(decision.timestamp, now),
                title: asString(decision.title) || 'Untitled decision',
                reason: asString(decision.reason) || 'No reason recorded.',
                status:
                    decision.status === 'proposed' ||
                    decision.status === 'accepted' ||
                    decision.status === 'rejected' ||
                    decision.status === 'superseded'
                        ? decision.status
                        : 'accepted',
                source:
                    decision.source === 'user' || decision.source === 'ai' || decision.source === 'system'
                        ? decision.source
                        : 'system',
                context: asString(decision.context),
                tags: asStringArray(decision.tags),
                relatedFiles: asStringArray(decision.relatedFiles)
            };
        })
    };
}

export function normalizeJournalMemoryDocument(
    value: Partial<JournalMemoryDocument> | undefined,
    now: number
): JournalMemoryDocument {
    const fallback = createJournalMemoryDocument(now);
    const root = asRecord(value);
    const entries = Array.isArray(root.entries) ? root.entries : [];

    return {
        schemaVersion: MEMORY_SCHEMA_VERSION,
        createdAt: asNumber(root.createdAt, fallback.createdAt),
        updatedAt: asNumber(root.updatedAt, fallback.updatedAt),
        entries: entries.map((item, index) => {
            const entry = asRecord(item);
            return {
                id: asString(entry.id) || `journal_${now}_${index}`,
                timestamp: asNumber(entry.timestamp, now),
                summary: asString(entry.summary) || 'No summary recorded.',
                why: asString(entry.why) || 'No reason recorded.',
                changedFiles: asStringArray(entry.changedFiles),
                completed: asStringArray(entry.completed),
                nextStep: asString(entry.nextStep),
                tags: asStringArray(entry.tags)
            };
        })
    };
}

export function normalizeMemoryIndexDocument(
    value: Partial<MemoryIndexDocument> | undefined,
    now: number
): MemoryIndexDocument {
    void value;
    return createMemoryIndexDocument(now);
}
