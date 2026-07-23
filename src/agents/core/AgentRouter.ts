import { AgentRegistry } from './AgentRegistry';
import { IAgent } from './IAgent';
import { ReasoningEngine } from '../../reasoning/ReasoningEngine';
import { AgentProfile } from '../../context/types';

export class AgentRouter {
    private readonly reasoningEngine: ReasoningEngine;
    private readonly registry: AgentRegistry;

    constructor(workspaceRoot: string) {
        this.reasoningEngine = new ReasoningEngine(workspaceRoot);
        this.registry = AgentRegistry.getInstance();
    }

    /**
     * Niyet (Intent) sınıflandırmasına göre uygun ajanı seçer.
     */
    public route(taskDescription: string): IAgent {
        const intent = this.reasoningEngine.classify(taskDescription);

        let targetProfile: AgentProfile = 'planner'; // Default fallback

        switch (intent) {
            case 'review':
                targetProfile = 'reviewer';
                break;
            case 'architecture':
                targetProfile = 'architect';
                break;
            case 'test':
                targetProfile = 'prompt_engineer'; // Veya rule-based için prompt engineer
                break;
            case 'documentation':
                targetProfile = 'prompt_engineer';
                break;
            case 'analysis':
                targetProfile = 'memory_manager'; // Analiz sonuçlarını bellek kaydetmeye
                break;
            case 'bugfix':
            case 'feature':
            case 'refactor':
            default:
                targetProfile = 'planner';
                break;
        }

        const agent = this.registry.getAgentByProfile(targetProfile);
        if (!agent) {
            // Hiçbiri yoksa bulabildiği ilk ajanı döndür
            const all = this.registry.getAllAgents();
            if (all.length > 0) return all[0];
            throw new Error(`[AgentRouter] No agents registered to handle profile: ${targetProfile}`);
        }

        return agent;
    }
}
