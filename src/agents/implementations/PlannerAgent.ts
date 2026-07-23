import { BaseAgent } from '../core/BaseAgent';
import { AgentRunInput, AgentRunResult } from '../core/IAgent';
import { ContextPackage } from '../../context/types';

export class PlannerAgent extends BaseAgent {
    constructor(workspaceRoot: string) {
        super('planner_agent', 'planner', workspaceRoot);
    }

    protected async execute(input: AgentRunInput, context: ContextPackage): Promise<AgentRunResult> {
        try {
            // Reasoning Engine orkestrasyonunu kullan
            const reasoningResult = await this.reasoningEngine.analyze({
                taskDescription: input.taskDescription,
                contextPackage: context,
                options: {
                    forceRefresh: input.inputs?.forceRefreshReasoning
                }
            });

            if (!reasoningResult.validation.valid) {
                return {
                    success: false,
                    output: 'Reasoning plan validation failed.',
                    errors: reasoningResult.validation.errors
                };
            }

            return {
                success: true,
                output: `Planner successfully generated plan: ${reasoningResult.plan.id} with strategy: ${reasoningResult.strategy}`,
                data: {
                    reasoningResult,
                    plan: reasoningResult.plan
                }
            };
        } catch (error: any) {
            return {
                success: false,
                output: '',
                errors: [error?.message || String(error)]
            };
        }
    }
}
