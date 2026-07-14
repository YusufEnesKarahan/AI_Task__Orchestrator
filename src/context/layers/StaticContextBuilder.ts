import { BuildContextInput, ContextLayerBuilder, ContextSourceBundle } from '../types';
import { createContextItem } from './helpers';

export class StaticContextBuilder implements ContextLayerBuilder {
    public readonly layer = 'static' as const;

    public async build(_input: BuildContextInput, sources: ContextSourceBundle) {
        const staticMemory = sources.memory.static.staticMemory;
        const content = [
            `Project: ${staticMemory.project?.name || sources.knowledge.projectName}`,
            `Type: ${staticMemory.project?.type || sources.knowledge.projectType}`,
            `Technologies: ${(staticMemory.technologies.length ? staticMemory.technologies : sources.knowledge.technologies.map((t) => t.name)).join(', ')}`,
            `Modules: ${(staticMemory.modules.length ? staticMemory.modules : sources.knowledge.modules).join(', ')}`,
            `Database: ${staticMemory.database?.type || sources.knowledge.database.type}`,
            `Coding rules: ${staticMemory.codingRules.join('; ') || 'No coding rules recorded.'}`
        ].join('\n');

        return [
            createContextItem({
                id: 'static:project-memory',
                layer: this.layer,
                title: 'Static project memory',
                content,
                score: 88,
                source: 'memory.json',
                tags: ['project', 'static', 'rules']
            })
        ];
    }
}
