import { BuildContextInput, ContextLayerBuilder, ContextSourceBundle } from '../types';
import { createContextItem } from './helpers';

export class RiskContextBuilder implements ContextLayerBuilder {
    public readonly layer = 'risk' as const;

    public async build(_input: BuildContextInput, sources: ContextSourceBundle) {
        const risks = [
            ...sources.risk.largeFiles.map((file) => `Large file: ${file}`),
            ...sources.risk.largeComponents.map((file) => `Large component: ${file}`),
            ...sources.risk.duplicateCode.map((item) => `Duplicate code: ${item}`),
            ...sources.risk.circularDependencies.map((cycle) => `Circular dependency: ${cycle.join(' -> ')}`),
            ...sources.risk.architectureViolations
        ];

        return [
            createContextItem({
                id: 'risk:report',
                layer: this.layer,
                title: 'Risk report',
                content: risks.length ? risks.join('\n') : 'No critical risks detected.',
                score: risks.length ? 90 : 40,
                source: 'risk.json',
                tags: ['risk', ...risks.slice(0, 10)]
            })
        ];
    }
}
