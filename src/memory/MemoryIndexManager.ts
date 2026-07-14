import { createMemoryIndexDocument, MEMORY_FILE_NAMES } from './defaults';
import {
    MemoryIndexDocument,
    MemoryIndexEntry,
    MemoryLayer,
    MemorySearchResult,
    MemorySnapshot,
    SearchMemoryOptions
} from './types';

function tokenize(value: string): string[] {
    return value
        .toLowerCase()
        .split(/[^a-z0-9_./-]+/i)
        .filter(Boolean);
}

function scoreEntry(entry: MemoryIndexEntry, queryTokens: string[]): number {
    const haystack = tokenize(`${entry.title} ${entry.key} ${entry.tags.join(' ')}`);
    return queryTokens.reduce((score, token) => score + haystack.filter((item) => item.includes(token)).length, 0);
}

export class MemoryIndexManager {
    public build(snapshot: Omit<MemorySnapshot, 'index'>, now = Date.now()): MemoryIndexDocument {
        const index = createMemoryIndexDocument(now);
        const entries: MemoryIndexEntry[] = [];

        const addEntry = (entry: MemoryIndexEntry) => entries.push(entry);

        addEntry({
            layer: 'static',
            file: MEMORY_FILE_NAMES.static,
            key: 'staticMemory',
            title: 'Project static memory',
            updatedAt: snapshot.static.updatedAt,
            tags: [
                ...snapshot.static.staticMemory.technologies,
                ...snapshot.static.staticMemory.modules,
                snapshot.static.staticMemory.project?.type || ''
            ].filter(Boolean)
        });

        addEntry({
            layer: 'longTerm',
            file: MEMORY_FILE_NAMES.static,
            key: 'longTermMemory',
            title: 'Long term project memory',
            updatedAt: snapshot.static.updatedAt,
            tags: [
                ...snapshot.static.longTermMemory.userPreferences,
                ...snapshot.static.longTermMemory.technicalDebt,
                ...snapshot.static.longTermMemory.learnedPatterns
            ]
        });

        addEntry({
            layer: 'working',
            file: MEMORY_FILE_NAMES.working,
            key: 'workingMemory',
            title: snapshot.working.workingMemory.currentGoal || 'Current working memory',
            updatedAt: snapshot.working.updatedAt,
            tags: [
                snapshot.working.workingMemory.currentSprint || '',
                snapshot.working.workingMemory.currentTask || '',
                ...snapshot.working.workingMemory.modifiedFiles
            ].filter(Boolean)
        });

        for (const decision of snapshot.decisions.decisions) {
            addEntry({
                layer: 'decision',
                file: MEMORY_FILE_NAMES.decision,
                key: decision.id,
                title: decision.title,
                updatedAt: decision.timestamp,
                tags: [decision.status, decision.source, ...decision.tags, ...decision.relatedFiles]
            });
        }

        for (const entry of snapshot.journal.entries) {
            addEntry({
                layer: 'journal',
                file: MEMORY_FILE_NAMES.journal,
                key: entry.id,
                title: entry.summary,
                updatedAt: entry.timestamp,
                tags: [...entry.tags, ...entry.changedFiles, ...entry.completed]
            });
        }

        return {
            ...index,
            updatedAt: now,
            counts: {
                static: 1,
                working: 1,
                longTerm: 1,
                decision: snapshot.decisions.decisions.length,
                journal: snapshot.journal.entries.length
            },
            entries
        };
    }

    public search(index: MemoryIndexDocument, query: string, options: SearchMemoryOptions = {}): MemorySearchResult[] {
        const tokens = tokenize(query);
        if (tokens.length === 0) {
            return [];
        }

        const allowedLayers = new Set<MemoryLayer>(
            options.layers || ['static', 'working', 'longTerm', 'decision', 'journal']
        );
        const limit = options.limit ?? 10;

        return index.entries
            .filter((entry) => allowedLayers.has(entry.layer))
            .map((entry) => ({
                entry,
                score: scoreEntry(entry, tokens)
            }))
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score || b.entry.updatedAt - a.entry.updatedAt)
            .slice(0, limit)
            .map(({ entry, score }) => ({
                layer: entry.layer,
                file: entry.file,
                key: entry.key,
                title: entry.title,
                score,
                excerpt: entry.title,
                tags: entry.tags,
                updatedAt: entry.updatedAt
            }));
    }
}
