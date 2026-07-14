import { AGENT_PROFILES } from '../AgentProfiles';
import { BuildContextInput, ContextLayerBuilder, ContextSourceBundle } from '../types';
import { createContextItem } from './helpers';

export class AgentContextBuilder implements ContextLayerBuilder {
    public readonly layer = 'agent' as const;

    public async build(input: BuildContextInput, _sources: ContextSourceBundle) {
        const agent = input.agent || 'planner';
        const profile = AGENT_PROFILES[agent];

        return [
            createContextItem({
                id: `agent:${agent}`,
                layer: this.layer,
                title: `${agent} context profile`,
                content: [
                    `Agent: ${agent}`,
                    `Preferred layers: ${profile.preferredLayers.join(', ')}`,
                    `Focus: ${profile.focus.join(', ')}`
                ].join('\n'),
                score: 84,
                source: 'agent-profile',
                tags: ['agent', agent, ...profile.preferredLayers]
            })
        ];
    }
}
