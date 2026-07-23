import { ContextEngine } from '../../context/ContextEngine';
import { ReasoningEngine } from '../../reasoning/ReasoningEngine';
import { AIGateway } from '../../ai/gateway/AIGateway';
import { EventBus } from '../../shared/events/EventBus';
import { AgentProfile, ContextPackage } from '../../context/types';
import { AgentRunInput, AgentRunResult, IAgent } from './IAgent';

export abstract class BaseAgent implements IAgent {
    public readonly id: string;
    public readonly profile: AgentProfile;
    
    protected readonly workspaceRoot: string;
    protected readonly contextEngine: ContextEngine;
    protected readonly reasoningEngine: ReasoningEngine;
    protected readonly aiGateway: AIGateway;
    protected readonly eventBus: EventBus;

    constructor(id: string, profile: AgentProfile, workspaceRoot: string) {
        this.id = id;
        this.profile = profile;
        this.workspaceRoot = workspaceRoot;
        
        // Ortak servislerin ilklendirilmesi
        this.contextEngine = new ContextEngine(workspaceRoot);
        this.reasoningEngine = new ReasoningEngine(workspaceRoot);
        this.aiGateway = AIGateway.getInstance();
        this.eventBus = EventBus.getInstance();
    }

    /**
     * Alt sınıflar tarafından ezilecek olan çalıştırıcı şablon metodu.
     */
    protected abstract execute(input: AgentRunInput, context: ContextPackage): Promise<AgentRunResult>;

    /**
     * Dışarıdan ajanı tetikleyen metot. Lifecycle eventlerini yönetir.
     */
    public async run(input: AgentRunInput): Promise<AgentRunResult> {
        this.eventBus.emit('AgentRunStarted', {
            agentId: this.id,
            profile: this.profile,
            input
        });

        try {
            // 1. Context Engine'i kullanarak ilgili ajana özel bağlamı alalım
            const context = await this.contextEngine.buildContext({
                agent: this.profile,
                task: {
                    title: `Agent execution: ${this.id}`,
                    description: input.taskDescription,
                    type: input.inputs?.taskType
                },
                forceRefresh: input.forceRefreshContext
            });

            // 2. Ajanın asıl mantığını çalıştır
            const result = await this.execute(input, context);

            if (result.success) {
                this.eventBus.emit('AgentRunCompleted', {
                    agentId: this.id,
                    profile: this.profile,
                    result
                });
            } else {
                this.eventBus.emit('AgentRunFailed', {
                    agentId: this.id,
                    profile: this.profile,
                    error: result.errors?.join(', ') || 'Unknown execution error'
                });
            }

            return result;
        } catch (error: any) {
            const errorMessage = error?.message || String(error);
            this.eventBus.emit('AgentRunFailed', {
                agentId: this.id,
                profile: this.profile,
                error: errorMessage
            });

            return {
                success: false,
                output: '',
                errors: [errorMessage]
            };
        }
    }
}
