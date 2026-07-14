import { AGENT_PROFILES } from './AgentProfiles';
import { AgentProfile, BuildContextInput, ContextLayer } from './types';

const DEFAULT_LAYERS: ContextLayer[] = ['task', 'project', 'working', 'knowledge', 'code', 'agent'];

const TASK_LAYER_RULES: Record<string, ContextLayer[]> = {
    feature: ['task', 'architecture', 'knowledge', 'code', 'working', 'decision', 'agent'],
    code_generation: ['task', 'architecture', 'knowledge', 'code', 'working', 'decision', 'agent'],
    bug_fix: ['task', 'code', 'working', 'decision', 'journal', 'risk', 'health', 'agent'],
    fix: ['task', 'code', 'working', 'decision', 'journal', 'risk', 'health', 'agent'],
    refactor: ['task', 'architecture', 'code', 'risk', 'health', 'decision', 'agent'],
    code_review: ['task', 'code', 'risk', 'health', 'architecture', 'decision', 'agent'],
    review: ['task', 'code', 'risk', 'health', 'architecture', 'decision', 'agent'],
    test_generation: ['task', 'code', 'health', 'risk', 'working', 'agent'],
    documentation: ['task', 'project', 'knowledge', 'architecture', 'journal', 'agent'],
    planning: ['task', 'project', 'working', 'knowledge', 'decision', 'journal', 'agent']
};

export class ContextSelector {
    public selectLayers(input: BuildContextInput): ContextLayer[] {
        const taskType = input.task?.type || 'planning';
        const agent = input.agent || 'planner';
        const taskLayers = TASK_LAYER_RULES[taskType] || DEFAULT_LAYERS;
        const agentLayers = this.getAgentLayers(agent);

        return this.unique([...taskLayers, ...agentLayers]);
    }

    private getAgentLayers(agent: AgentProfile): ContextLayer[] {
        return AGENT_PROFILES[agent]?.preferredLayers || AGENT_PROFILES.planner.preferredLayers;
    }

    private unique(values: ContextLayer[]): ContextLayer[] {
        return Array.from(new Set(values));
    }
}
