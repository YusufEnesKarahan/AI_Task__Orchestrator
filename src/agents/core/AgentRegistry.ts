import { IAgent } from './IAgent';
import { AgentProfile } from '../../context/types';

export class AgentRegistry {
    private static instance: AgentRegistry;
    private readonly agents = new Map<string, IAgent>();

    private constructor() {}

    public static getInstance(): AgentRegistry {
        if (!AgentRegistry.instance) {
            AgentRegistry.instance = new AgentRegistry();
        }
        return AgentRegistry.instance;
    }

    /**
     * Ajani sisteme kaydeder.
     */
    public register(agent: IAgent): void {
        this.agents.set(agent.id, agent);
    }

    /**
     * ID ile ajan getirir.
     */
    public getAgent(id: string): IAgent | undefined {
        return this.agents.get(id);
    }

    /**
     * Profil tipine göre ilk eşleşen ajanı getirir.
     */
    public getAgentByProfile(profile: AgentProfile): IAgent | undefined {
        return Array.from(this.agents.values()).find(agent => agent.profile === profile);
    }

    /**
     * Kayıtlı tüm ajanları döndürür.
     */
    public getAllAgents(): IAgent[] {
        return Array.from(this.agents.values());
    }

    /**
     * Tüm kayıtları temizler (testlerde yararlı).
     */
    public clear(): void {
        this.agents.clear();
    }
}
