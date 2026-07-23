import { BaseAgent } from '../core/BaseAgent';
import { AgentRunInput, AgentRunResult } from '../core/IAgent';
import { ContextPackage } from '../../context/types';
import { MemoryEngine } from '../../memory/MemoryEngine';

export class MemoryManagerAgent extends BaseAgent {
    private readonly memoryEngine: MemoryEngine;

    constructor(workspaceRoot: string) {
        super('memory_manager_agent', 'memory_manager', workspaceRoot);
        this.memoryEngine = new MemoryEngine(workspaceRoot);
    }

    protected async execute(input: AgentRunInput, context: ContextPackage): Promise<AgentRunResult> {
        const decisionInput = input.inputs?.decision;
        const journalInput = input.inputs?.journal;
        const workingMemoryUpdates = input.inputs?.workingMemory;

        if (!decisionInput && !journalInput && !workingMemoryUpdates) {
            return {
                success: false,
                output: 'No memory updates provided.',
                errors: ['Missing inputs: decision, journal, or workingMemory']
            };
        }

        try {
            const dataSaved: Record<string, any> = {};

            // 1. Karar (Decision) Ekleme
            if (decisionInput) {
                const decision = await this.memoryEngine.addDecision(decisionInput);
                dataSaved.decision = decision;
            }

            // 2. Günlük Kaydı (Journal) Ekleme
            if (journalInput) {
                const journal = await this.memoryEngine.addJournalEntry(journalInput);
                dataSaved.journal = journal;
            }

            // 3. Çalışma Belleği (Working Memory) Güncelleme
            if (workingMemoryUpdates) {
                const snapshot = await this.memoryEngine.updateWorkingMemory(workingMemoryUpdates);
                dataSaved.workingMemory = snapshot.working;
            }

            return {
                success: true,
                output: 'Memory manager agent successfully synchronized state to disk.',
                data: dataSaved
            };
        } catch (error: any) {
            return {
                success: false,
                output: '',
                errors: [error?.message || String(error)]
            };
        }
    }
}
