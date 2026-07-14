import { BuildContextInput, ContextLayerBuilder, ContextSourceBundle } from '../types';
import { createContextItem } from './helpers';

export class WorkingContextBuilder implements ContextLayerBuilder {
    public readonly layer = 'working' as const;

    public async build(_input: BuildContextInput, sources: ContextSourceBundle) {
        const working = sources.memory.working.workingMemory;
        return [
            createContextItem({
                id: 'working:current-state',
                layer: this.layer,
                title: working.currentGoal || 'Current working memory',
                content: [
                    `Current sprint: ${working.currentSprint || 'Unknown'}`,
                    `Current goal: ${working.currentGoal || 'Unknown'}`,
                    `Current task: ${working.currentTask || 'Unknown'}`,
                    `Current branch: ${working.currentBranch || 'Unknown'}`,
                    `Recent changes: ${working.recentChanges.join('; ') || 'None'}`,
                    `Modified files: ${working.modifiedFiles.join(', ') || 'None'}`,
                    `Open problems: ${working.openProblems.join('; ') || 'None'}`
                ].join('\n'),
                score: 94,
                source: 'working-memory.json',
                tags: ['working', working.currentSprint || '', ...(working.modifiedFiles || [])].filter(Boolean)
            })
        ];
    }
}
