import { BuildContextInput, ContextLayerBuilder, ContextSourceBundle } from '../types';
import { createContextItem } from './helpers';

export class TaskContextBuilder implements ContextLayerBuilder {
    public readonly layer = 'task' as const;

    public async build(input: BuildContextInput, _sources: ContextSourceBundle) {
        if (!input.task) {
            return [];
        }

        return [
            createContextItem({
                id: `task:${input.task.id || input.task.title}`,
                layer: this.layer,
                title: input.task.title,
                content: [
                    `Task: ${input.task.title}`,
                    `Description: ${input.task.description || 'No description.'}`,
                    `Type: ${input.task.type || 'code_generation'}`,
                    `Priority: ${input.task.priority || 'medium'}`
                ].join('\n'),
                score: 100,
                source: 'request',
                tags: ['task', input.task.type || 'code_generation', input.task.priority || 'medium']
            })
        ];
    }
}
