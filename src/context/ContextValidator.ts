import { ContextPackage, ContextValidationResult } from './types';

export class ContextValidator {
    public validateContext(context: ContextPackage): ContextValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [...context.warnings];

        if (context.items.length === 0) {
            errors.push('Context is empty.');
        }

        if (!context.memory.currentGoal && !context.memory.currentSprint) {
            warnings.push('Working memory is missing current sprint and current goal.');
        }

        if (context.knowledge.technologies.length === 0 || context.knowledge.modules.length === 0) {
            warnings.push('Knowledge context is incomplete.');
        }

        if (context.tokenEstimate > context.tokenBudget) {
            errors.push('Context exceeds token budget.');
        }

        const ids = new Set<string>();
        const duplicateIds = new Set<string>();
        for (const item of context.items) {
            if (ids.has(item.id)) {
                duplicateIds.add(item.id);
            }
            ids.add(item.id);
        }

        if (duplicateIds.size > 0) {
            errors.push(`Context contains duplicate items: ${Array.from(duplicateIds).join(', ')}`);
        }

        if (!context.project.name || !context.project.type) {
            errors.push('Project context is inconsistent.');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings: Array.from(new Set(warnings))
        };
    }
}
