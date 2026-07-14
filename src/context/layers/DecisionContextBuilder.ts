import { BuildContextInput, ContextLayerBuilder, ContextSourceBundle } from '../types';
import { createContextItem } from './helpers';

export class DecisionContextBuilder implements ContextLayerBuilder {
    public readonly layer = 'decision' as const;

    public async build(_input: BuildContextInput, sources: ContextSourceBundle) {
        return sources.memory.decisions.decisions.slice(0, 8).map((decision, index) =>
            createContextItem({
                id: `decision:${decision.id}`,
                layer: this.layer,
                title: decision.title,
                content: [
                    `Decision: ${decision.title}`,
                    `Reason: ${decision.reason}`,
                    `Status: ${decision.status}`,
                    `Source: ${decision.source}`,
                    `Related files: ${decision.relatedFiles.join(', ') || 'None'}`
                ].join('\n'),
                score: Math.max(55, 90 - index * 5),
                source: 'decisions.json',
                tags: [decision.status, decision.source, ...decision.tags, ...decision.relatedFiles]
            })
        );
    }
}
