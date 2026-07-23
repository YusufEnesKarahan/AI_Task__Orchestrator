import { BaseAgent } from '../core/BaseAgent';
import { AgentRunInput, AgentRunResult } from '../core/IAgent';
import { ContextPackage } from '../../context/types';

export class ReviewerAgent extends BaseAgent {
    constructor(workspaceRoot: string) {
        super('reviewer_agent', 'reviewer', workspaceRoot);
    }

    protected async execute(input: AgentRunInput, context: ContextPackage): Promise<AgentRunResult> {
        const artifactToReview = input.inputs?.artifactToReview || input.taskDescription;
        const testCoverageRequired = input.inputs?.requireTests ?? true;

        try {
            const issues: string[] = [];
            
            // Basit kod inceleme kuralları (Heuristic)
            if (testCoverageRequired && !artifactToReview.toLowerCase().includes('test')) {
                issues.push('Test Coverage Gap: Projede değişiklikler için test dosyası veya test adımları belirtilmemiş.');
            }

            // TODO/FIXME kontrolleri
            if (artifactToReview.includes('TODO') || artifactToReview.includes('FIXME')) {
                issues.push('Code smell: Kod tabanında tamamlanmamış TODO veya FIXME etiketleri mevcut.');
            }

            return {
                success: true,
                output: issues.length === 0 ? 'Review passed with no issues.' : `Review found issues:\n${issues.join('\n')}`,
                data: {
                    reviewPassed: issues.length === 0,
                    issuesFound: issues
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
