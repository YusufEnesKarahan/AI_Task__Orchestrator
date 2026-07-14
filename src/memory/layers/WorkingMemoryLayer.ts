import { UpdateWorkingMemoryInput, WorkingMemoryDocument } from '../types';

function uniquePreserveOrder(values: string[], maxItems = 50): string[] {
    const seen = new Set<string>();
    const output: string[] = [];

    for (const value of values) {
        const normalized = value.trim();
        if (normalized && !seen.has(normalized)) {
            seen.add(normalized);
            output.push(normalized);
        }
    }

    return output.slice(0, maxItems);
}

export class WorkingMemoryLayer {
    public update(
        document: WorkingMemoryDocument,
        updates: UpdateWorkingMemoryInput,
        now = Date.now()
    ): WorkingMemoryDocument {
        return {
            ...document,
            updatedAt: now,
            workingMemory: {
                ...document.workingMemory,
                ...updates,
                recentChanges: updates.recentChanges
                    ? uniquePreserveOrder([...updates.recentChanges, ...document.workingMemory.recentChanges])
                    : document.workingMemory.recentChanges,
                modifiedFiles: updates.modifiedFiles
                    ? uniquePreserveOrder([...updates.modifiedFiles, ...document.workingMemory.modifiedFiles])
                    : document.workingMemory.modifiedFiles,
                pendingTasks: updates.pendingTasks
                    ? uniquePreserveOrder(updates.pendingTasks)
                    : document.workingMemory.pendingTasks,
                openProblems: updates.openProblems
                    ? uniquePreserveOrder(updates.openProblems)
                    : document.workingMemory.openProblems
            }
        };
    }
}
