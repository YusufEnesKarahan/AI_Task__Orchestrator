import { ContextBudget, ContextItem } from './types';

export const CONTEXT_TOKEN_BUDGETS: Record<ContextBudget, number> = {
    small: 1200,
    medium: 3000,
    large: 7000,
    unlimited: Number.MAX_SAFE_INTEGER
};

export class ContextBudgetManager {
    public getTokenBudget(budget: ContextBudget): number {
        return CONTEXT_TOKEN_BUDGETS[budget];
    }

    public applyBudget(
        items: ContextItem[],
        budget: ContextBudget
    ): { included: ContextItem[]; excluded: ContextItem[] } {
        if (budget === 'unlimited') {
            return { included: items, excluded: [] };
        }

        const tokenBudget = this.getTokenBudget(budget);
        const included: ContextItem[] = [];
        const excluded: ContextItem[] = [];
        let usedTokens = 0;

        for (const item of items) {
            if (usedTokens + item.tokenEstimate <= tokenBudget) {
                included.push(item);
                usedTokens += item.tokenEstimate;
            } else {
                excluded.push(item);
            }
        }

        return { included, excluded };
    }
}
