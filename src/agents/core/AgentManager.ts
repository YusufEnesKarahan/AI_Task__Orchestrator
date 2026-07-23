import { AgentRegistry } from './AgentRegistry';
import { AgentRouter } from './AgentRouter';
import { AgentPipeline } from './AgentPipeline';
import { AgentRunInput, AgentRunResult } from './IAgent';
import { PlannerAgent } from '../implementations/PlannerAgent';
import { ArchitectureAgent } from '../implementations/ArchitectureAgent';
import { PromptEngineerAgent } from '../implementations/PromptEngineerAgent';
import { ReviewerAgent } from '../implementations/ReviewerAgent';
import { MemoryManagerAgent } from '../implementations/MemoryManagerAgent';

export class AgentManager {
    private readonly registry = AgentRegistry.getInstance();
    private readonly router: AgentRouter;
    private readonly workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.router = new AgentRouter(workspaceRoot);
        this.registerDefaultAgents();
    }

    /**
     * Varsayılan tüm ajan örneklerini (instances) kaydeder.
     */
    private registerDefaultAgents(): void {
        this.registry.register(new PlannerAgent(this.workspaceRoot));
        this.registry.register(new ArchitectureAgent(this.workspaceRoot));
        this.registry.register(new PromptEngineerAgent(this.workspaceRoot));
        this.registry.register(new ReviewerAgent(this.workspaceRoot));
        this.registry.register(new MemoryManagerAgent(this.workspaceRoot));
    }

    /**
     * Sırasıyla tüm ajanları çalıştıran standart bir pipeline oluşturur.
     */
    public createDefaultPipeline(id?: string): AgentPipeline {
        const pipeline = new AgentPipeline(id);
        pipeline
            .addStep('planner_agent', 'Planlama')
            .addStep('architecture_agent', 'Mimari Kontrol')
            .addStep('prompt_engineer_agent', 'Prompt Optimizasyonu')
            .addStep('reviewer_agent', 'Kod İnceleme')
            .addStep('memory_manager_agent', 'Bellek Güncelleme');
        return pipeline;
    }

    /**
     * Gelen görevi Router aracılığıyla analiz edip doğrudan ilgili tek ajana yönlendirir.
     */
    public async runTask(taskDescription: string, inputs?: Record<string, any>): Promise<AgentRunResult> {
        try {
            const bestAgent = this.router.route(taskDescription);
            const input: AgentRunInput = {
                taskDescription,
                inputs
            };
            return await bestAgent.run(input);
        } catch (error: any) {
            return {
                success: false,
                output: '',
                errors: [error?.message || String(error)]
            };
        }
    }
}
