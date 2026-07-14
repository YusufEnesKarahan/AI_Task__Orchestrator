import { BuildContextInput, ContextLayerBuilder, ContextSourceBundle } from '../types';
import { createContextItem } from './helpers';

export class ProjectContextBuilder implements ContextLayerBuilder {
    public readonly layer = 'project' as const;

    public async build(_input: BuildContextInput, sources: ContextSourceBundle) {
        return [
            createContextItem({
                id: 'project:overview',
                layer: this.layer,
                title: 'Project overview',
                content: [
                    `${sources.knowledge.projectName} is a ${sources.knowledge.projectType}.`,
                    `Approximate scanned file count: ${sources.fileCount}.`,
                    `Workspace hash: ${sources.knowledge.workspaceHash}.`
                ].join('\n'),
                score: 82,
                source: 'knowledge.json',
                tags: ['project', 'overview']
            })
        ];
    }
}
