import { AgentProfile, ContextLayer } from './types';

export interface AgentProfileDefinition {
    agent: AgentProfile;
    preferredLayers: ContextLayer[];
    focus: string[];
}

export const AGENT_PROFILES: Record<AgentProfile, AgentProfileDefinition> = {
    planner: {
        agent: 'planner',
        preferredLayers: ['task', 'project', 'working', 'knowledge', 'decision', 'journal'],
        focus: ['goal decomposition', 'dependencies', 'pending work']
    },
    reviewer: {
        agent: 'reviewer',
        preferredLayers: ['task', 'code', 'risk', 'health', 'decision', 'architecture'],
        focus: ['regressions', 'risk', 'test gaps']
    },
    architect: {
        agent: 'architect',
        preferredLayers: ['task', 'architecture', 'knowledge', 'risk', 'health', 'decision'],
        focus: ['boundaries', 'patterns', 'technical debt']
    },
    prompt_engineer: {
        agent: 'prompt_engineer',
        preferredLayers: ['task', 'static', 'working', 'knowledge', 'agent'],
        focus: ['prompt constraints', 'target agent needs', 'handoff clarity']
    },
    memory_manager: {
        agent: 'memory_manager',
        preferredLayers: ['working', 'decision', 'journal', 'static'],
        focus: ['memory hygiene', 'decisions', 'current state']
    }
};
