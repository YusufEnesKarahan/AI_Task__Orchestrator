import { ContextItem, ContextLayer } from '../types';

export function estimateTokens(value: string): number {
    return Math.max(1, Math.ceil(value.length / 4));
}

export function createContextItem(input: {
    id: string;
    layer: ContextLayer;
    title: string;
    content: string;
    score: number;
    source: string;
    tags?: string[];
    data?: unknown;
}): ContextItem {
    return {
        ...input,
        tags: input.tags || [],
        tokenEstimate: estimateTokens(input.content)
    };
}

export function unique(values: string[], limit?: number): string[] {
    const output = Array.from(new Set(values.filter((value) => value.trim()).map((value) => value.trim())));
    return typeof limit === 'number' ? output.slice(0, limit) : output;
}
