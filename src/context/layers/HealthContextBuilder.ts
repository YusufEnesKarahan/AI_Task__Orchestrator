import { BuildContextInput, ContextLayerBuilder, ContextSourceBundle } from '../types';
import { createContextItem } from './helpers';

export class HealthContextBuilder implements ContextLayerBuilder {
    public readonly layer = 'health' as const;

    public async build(_input: BuildContextInput, sources: ContextSourceBundle) {
        const health = sources.health;
        return [
            createContextItem({
                id: 'health:report',
                layer: this.layer,
                title: 'Code health report',
                content: [
                    `Architecture: ${health.architectureScore}/100`,
                    `Maintainability: ${health.maintainability}/100`,
                    `Complexity: ${health.complexity}/100`,
                    `Documentation: ${health.documentation}/100`,
                    `Testing: ${health.testing}/100`,
                    `Security: ${health.security}/100`,
                    `Technical debt: ${health.technicalDebt}/100`
                ].join('\n'),
                score: 78,
                source: 'health.json',
                tags: ['health', 'quality', 'technical-debt']
            })
        ];
    }
}
