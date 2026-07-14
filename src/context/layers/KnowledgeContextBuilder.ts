import { BuildContextInput, ContextLayerBuilder, ContextSourceBundle } from '../types';
import { createContextItem } from './helpers';

export class KnowledgeContextBuilder implements ContextLayerBuilder {
    public readonly layer = 'knowledge' as const;

    public async build(_input: BuildContextInput, sources: ContextSourceBundle) {
        return [
            createContextItem({
                id: 'knowledge:project-facts',
                layer: this.layer,
                title: 'Project knowledge facts',
                content: [
                    `Technologies: ${sources.knowledge.technologies.map((tech) => `${tech.name} (${tech.type})`).join(', ')}`,
                    `Modules: ${sources.knowledge.modules.join(', ')}`,
                    `Services: ${sources.knowledge.services.join(', ') || 'None detected'}`,
                    `Routes: ${sources.knowledge.routes.join(', ') || 'None detected'}`,
                    `Database: ${sources.knowledge.database.type}`,
                    `Known issues: ${sources.knowledge.knownIssues.join('; ') || 'None recorded'}`
                ].join('\n'),
                score: 86,
                source: 'knowledge.json',
                tags: [
                    'knowledge',
                    ...sources.knowledge.technologies.map((tech) => tech.name),
                    ...sources.knowledge.modules
                ]
            })
        ];
    }
}
