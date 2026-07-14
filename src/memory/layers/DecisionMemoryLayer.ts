import { AddDecisionInput, DecisionMemoryDocument, DecisionRecord } from '../types';

function createId(prefix: string, now: number): string {
    return `${prefix}_${now}_${Math.floor(Math.random() * 100000)}`;
}

export class DecisionMemoryLayer {
    public addDecision(
        document: DecisionMemoryDocument,
        input: AddDecisionInput,
        now = Date.now()
    ): { document: DecisionMemoryDocument; decision: DecisionRecord } {
        const decision: DecisionRecord = {
            id: createId('decision', now),
            timestamp: now,
            title: input.title.trim(),
            reason: input.reason.trim(),
            status: input.status || 'accepted',
            source: input.source,
            context: input.context?.trim() || undefined,
            tags: input.tags || [],
            relatedFiles: input.relatedFiles || []
        };

        return {
            decision,
            document: {
                ...document,
                updatedAt: now,
                decisions: [decision, ...document.decisions]
            }
        };
    }
}
