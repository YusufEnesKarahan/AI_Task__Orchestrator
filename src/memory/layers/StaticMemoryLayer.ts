import { LongTermMemory, StaticMemoryDocument, UpdateStaticMemoryInput } from '../types';

function unique(values: string[]): string[] {
    return Array.from(new Set(values.filter((value) => value.trim()).map((value) => value.trim()))).sort();
}

export class StaticMemoryLayer {
    public update(
        document: StaticMemoryDocument,
        updates: UpdateStaticMemoryInput,
        now = Date.now()
    ): StaticMemoryDocument {
        const longTermMemory: LongTermMemory = {
            ...document.longTermMemory,
            ...updates.longTermMemory,
            userPreferences: unique([
                ...document.longTermMemory.userPreferences,
                ...(updates.longTermMemory?.userPreferences || [])
            ]),
            technicalDebt: unique([
                ...document.longTermMemory.technicalDebt,
                ...(updates.longTermMemory?.technicalDebt || [])
            ]),
            completedWork: unique([
                ...document.longTermMemory.completedWork,
                ...(updates.longTermMemory?.completedWork || [])
            ]),
            sprintHistory: unique([
                ...document.longTermMemory.sprintHistory,
                ...(updates.longTermMemory?.sprintHistory || [])
            ]),
            learnedPatterns: unique([
                ...document.longTermMemory.learnedPatterns,
                ...(updates.longTermMemory?.learnedPatterns || [])
            ])
        };

        return {
            ...document,
            updatedAt: now,
            staticMemory: {
                ...document.staticMemory,
                project: updates.project
                    ? { ...document.staticMemory.project, ...updates.project }
                    : document.staticMemory.project,
                architecture: updates.architecture
                    ? { ...document.staticMemory.architecture, ...updates.architecture }
                    : document.staticMemory.architecture,
                technologies: updates.technologies ? unique(updates.technologies) : document.staticMemory.technologies,
                folderStructure: updates.folderStructure
                    ? unique(updates.folderStructure)
                    : document.staticMemory.folderStructure,
                database: updates.database
                    ? { ...document.staticMemory.database, ...updates.database }
                    : document.staticMemory.database,
                modules: updates.modules ? unique(updates.modules) : document.staticMemory.modules,
                codingRules: updates.codingRules ? unique(updates.codingRules) : document.staticMemory.codingRules
            },
            longTermMemory
        };
    }
}
