import { BaseAgent } from '../core/BaseAgent';
import { AgentRunInput, AgentRunResult } from '../core/IAgent';
import { ContextPackage } from '../../context/types';
import { ExecutionPlan } from '../../reasoning/shared/reasoningTypes';

export class ArchitectureAgent extends BaseAgent {
    constructor(workspaceRoot: string) {
        super('architecture_agent', 'architect', workspaceRoot);
    }

    protected async execute(input: AgentRunInput, context: ContextPackage): Promise<AgentRunResult> {
        // Planner'dan veya dışarıdan gelen planı alalım
        const plan: ExecutionPlan = input.inputs?.plan;
        
        if (!plan) {
            return {
                success: false,
                output: 'No execution plan provided for architecture review.',
                errors: ['Missing input: plan']
            };
        }

        try {
            // Mimari analiz simülasyonu / kuralların kontrolü
            const warnings: string[] = [];
            const layers = context.architecture.type || 'unknown';

            // Basit mimari kurallar kontrolü:
            // Örneğin: UI katmanı doğrudan Database katmanına erişmemeli
            plan.steps.forEach(step => {
                const desc = step.description.toLowerCase();
                if (desc.includes('ui') && (desc.includes('database') || desc.includes('db') || desc.includes('query'))) {
                    warnings.push(`Architecture Warning in step "${step.id}": UI step seems to directly interact with Database layer.`);
                }
            });

            return {
                success: true,
                output: `Architecture review completed for plan: ${plan.id}. Project Architecture Type: ${layers}`,
                data: {
                    planApproved: warnings.length === 0,
                    architectureWarnings: warnings,
                    architectureType: layers
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
