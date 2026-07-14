import { BuildContextInput, ContextLayerBuilder, ContextSourceBundle } from '../types';
import { createContextItem } from './helpers';

export class ArchitectureContextBuilder implements ContextLayerBuilder {
    public readonly layer = 'architecture' as const;

    public async build(_input: BuildContextInput, sources: ContextSourceBundle) {
        return [
            createContextItem({
                id: 'architecture:map',
                layer: this.layer,
                title: sources.knowledge.architecture.type,
                content: [
                    `Architecture: ${sources.knowledge.architecture.type}`,
                    `Confidence: ${Math.round(sources.knowledge.architecture.confidence * 100)}%`,
                    `Layers: ${sources.architecture.layers.map((layer) => `${layer.name}=${layer.pathPattern}`).join(', ') || 'None inferred'}`,
                    `Entry points: ${sources.architecture.entryPoints.join(', ') || 'None detected'}`,
                    `Relations: ${sources.architecture.relations.length}`
                ].join('\n'),
                score: 92,
                source: 'architecture.json',
                tags: ['architecture', sources.knowledge.architecture.type, ...sources.architecture.modules]
            })
        ];
    }
}
