import { BuildContextInput, ContextLayerBuilder, ContextSourceBundle } from '../types';
import { createContextItem } from './helpers';

export class JournalContextBuilder implements ContextLayerBuilder {
    public readonly layer = 'journal' as const;

    public async build(_input: BuildContextInput, sources: ContextSourceBundle) {
        return sources.memory.journal.entries.slice(0, 6).map((entry, index) =>
            createContextItem({
                id: `journal:${entry.id}`,
                layer: this.layer,
                title: entry.summary,
                content: [
                    `Summary: ${entry.summary}`,
                    `Why: ${entry.why}`,
                    `Changed files: ${entry.changedFiles.join(', ') || 'None'}`,
                    `Completed: ${entry.completed.join('; ') || 'None'}`,
                    `Next step: ${entry.nextStep || 'Unknown'}`
                ].join('\n'),
                score: Math.max(30, 72 - index * 7),
                source: 'journal.json',
                tags: [...entry.tags, ...entry.changedFiles, ...entry.completed]
            })
        );
    }
}
