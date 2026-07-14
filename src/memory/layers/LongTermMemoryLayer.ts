import { LongTermMemory, StaticMemoryDocument } from '../types';

function unique(values: string[]): string[] {
    return Array.from(new Set(values.filter((value) => value.trim()).map((value) => value.trim()))).sort();
}

export class LongTermMemoryLayer {
    public merge(
        document: StaticMemoryDocument,
        updates: Partial<LongTermMemory>,
        now = Date.now()
    ): StaticMemoryDocument {
        return {
            ...document,
            updatedAt: now,
            longTermMemory: {
                userPreferences: unique([
                    ...document.longTermMemory.userPreferences,
                    ...(updates.userPreferences || [])
                ]),
                technicalDebt: unique([...document.longTermMemory.technicalDebt, ...(updates.technicalDebt || [])]),
                completedWork: unique([...document.longTermMemory.completedWork, ...(updates.completedWork || [])]),
                sprintHistory: unique([...document.longTermMemory.sprintHistory, ...(updates.sprintHistory || [])]),
                learnedPatterns: unique([
                    ...document.longTermMemory.learnedPatterns,
                    ...(updates.learnedPatterns || [])
                ])
            }
        };
    }
}
