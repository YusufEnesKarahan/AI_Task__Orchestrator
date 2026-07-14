import { BuildContextInput, ContextLayerBuilder, ContextSourceBundle } from '../types';
import { createContextItem, unique } from './helpers';

function matchesTask(value: string, query: string): boolean {
    return value.toLowerCase().includes(query.toLowerCase());
}

export class CodeContextBuilder implements ContextLayerBuilder {
    public readonly layer = 'code' as const;

    public async build(input: BuildContextInput, sources: ContextSourceBundle) {
        const taskText = `${input.task?.title || ''} ${input.task?.description || ''}`;
        const explicitFiles = input.task?.relatedFiles || [];
        const memoryFiles = sources.memory.working.workingMemory.modifiedFiles || [];
        const serviceFiles = sources.knowledge.services;
        const routeFiles = sources.knowledge.routes;
        const dependencyFiles = sources.knowledge.dependencies
            .filter((relation) => matchesTask(relation.from, taskText) || matchesTask(relation.to, taskText))
            .flatMap((relation) => [relation.from, relation.to]);

        const relatedFiles = unique(
            [...explicitFiles, ...memoryFiles, ...serviceFiles, ...routeFiles, ...dependencyFiles],
            20
        );
        const relatedModules = unique([...(input.task?.relatedModules || []), ...sources.knowledge.modules], 12);
        const dependencies = unique(
            sources.knowledge.dependencies.slice(0, 30).map((relation) => `${relation.from} -> ${relation.to}`),
            30
        );

        return [
            createContextItem({
                id: 'code:related-files',
                layer: this.layer,
                title: 'Related code references',
                content: [
                    `Related files: ${relatedFiles.join(', ') || 'None selected yet'}`,
                    `Related modules: ${relatedModules.join(', ') || 'None selected yet'}`,
                    `Dependencies: ${dependencies.join('; ') || 'None detected'}`
                ].join('\n'),
                score: relatedFiles.length > 0 ? 98 : 62,
                source: 'knowledge.json',
                tags: ['files', 'modules', 'dependencies', ...relatedFiles, ...relatedModules],
                data: { relatedFiles, relatedModules, dependencies }
            })
        ];
    }
}
