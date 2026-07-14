import { AddJournalEntryInput, JournalEntry, JournalMemoryDocument } from '../types';

function createId(prefix: string, now: number): string {
    return `${prefix}_${now}_${Math.floor(Math.random() * 100000)}`;
}

export class JournalMemoryLayer {
    public addEntry(
        document: JournalMemoryDocument,
        input: AddJournalEntryInput,
        now = Date.now()
    ): { document: JournalMemoryDocument; entry: JournalEntry } {
        const entry: JournalEntry = {
            id: createId('journal', now),
            timestamp: now,
            summary: input.summary.trim(),
            why: input.why.trim(),
            changedFiles: input.changedFiles || [],
            completed: input.completed || [],
            nextStep: input.nextStep?.trim() || undefined,
            tags: input.tags || []
        };

        return {
            entry,
            document: {
                ...document,
                updatedAt: now,
                entries: [entry, ...document.entries]
            }
        };
    }
}
