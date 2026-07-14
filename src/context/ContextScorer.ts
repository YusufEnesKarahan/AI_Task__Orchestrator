import { AGENT_PROFILES } from './AgentProfiles';
import { BuildContextInput, ContextItem } from './types';

function textMatches(item: ContextItem, query: string): boolean {
    const haystack = `${item.title} ${item.content} ${item.tags.join(' ')}`.toLowerCase();
    return query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .some((token) => haystack.includes(token));
}

export class ContextScorer {
    public scoreContext(items: ContextItem[], input: BuildContextInput): ContextItem[] {
        const agent = input.agent || 'planner';
        const preferredLayers = new Set(AGENT_PROFILES[agent].preferredLayers);
        const query = input.query || `${input.task?.title || ''} ${input.task?.description || ''}`;
        const explicitFiles = new Set(input.task?.relatedFiles || []);
        const explicitModules = new Set(input.task?.relatedModules || []);

        return items
            .map((item) => {
                let score = item.score;
                if (preferredLayers.has(item.layer)) score += 8;
                if (query.trim() && textMatches(item, query)) score += 10;
                if (item.tags.some((tag) => explicitFiles.has(tag) || explicitModules.has(tag))) score += 15;
                if (item.layer === 'journal') score -= 8;
                if (item.layer === 'risk' && item.content.includes('No critical risks')) score -= 20;

                return {
                    ...item,
                    score: Math.max(0, Math.min(100, score))
                };
            })
            .sort((a, b) => b.score - a.score || a.tokenEstimate - b.tokenEstimate);
    }
}
