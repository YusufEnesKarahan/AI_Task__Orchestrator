import { EventBus } from '../../shared/events/EventBus';
import { AgentRegistry } from './AgentRegistry';
import { AgentRunInput, AgentRunResult } from './IAgent';

export class AgentPipeline {
    public readonly id: string;
    private readonly steps: Array<{ agentId: string; label?: string }> = [];
    private readonly registry = AgentRegistry.getInstance();
    private readonly eventBus = EventBus.getInstance();

    constructor(id?: string) {
        this.id = id || `pipeline_${Date.now()}`;
    }

    /**
     * Pipeline'a çalıştırılacak yeni bir ajan adımı ekler.
     */
    public addStep(agentId: string, label?: string): this {
        this.steps.push({ agentId, label });
        return this;
    }

    /**
     * Pipeline üzerindeki tüm adımları sırayla çalıştırır.
     */
    public async run(initialInput: AgentRunInput): Promise<AgentRunResult> {
        this.eventBus.emit('PipelineStarted', {
            pipelineId: this.id,
            steps: this.steps.map(s => s.agentId)
        });

        let currentInput: AgentRunInput = { ...initialInput, inputs: { ...initialInput.inputs } };
        let finalResult: AgentRunResult = { success: false, output: '' };

        for (let i = 0; i < this.steps.length; i++) {
            const step = this.steps[i];
            const agent = this.registry.getAgent(step.agentId);

            if (!agent) {
                const errorMsg = `[AgentPipeline] Agent not found in registry: ${step.agentId}`;
                this.eventBus.emit('PipelineCompleted', {
                    pipelineId: this.id,
                    success: false,
                    finalData: { error: errorMsg }
                });
                return { success: false, output: '', errors: [errorMsg] };
            }

            // Ajanı çalıştır
            const stepResult = await agent.run(currentInput);
            finalResult = stepResult;

            this.eventBus.emit('PipelineStepCompleted', {
                pipelineId: this.id,
                stepIndex: i,
                agentId: step.agentId,
                result: stepResult
            });

            if (!stepResult.success) {
                // Herhangi bir adım başarısız olursa zinciri kır
                this.eventBus.emit('PipelineCompleted', {
                    pipelineId: this.id,
                    success: false,
                    finalData: stepResult.data
                });
                return stepResult;
            }

            // Bir sonraki adım için çıktı verilerini girdilere yay
            currentInput.inputs = {
                ...currentInput.inputs,
                ...stepResult.data,
                [`step_${i}_output`]: stepResult.output
            };
        }

        this.eventBus.emit('PipelineCompleted', {
            pipelineId: this.id,
            success: true,
            finalData: currentInput.inputs
        });

        return {
            success: true,
            output: `Pipeline completed successfully. Last step: ${this.steps[this.steps.length - 1].agentId}`,
            data: currentInput.inputs
        };
    }
}
