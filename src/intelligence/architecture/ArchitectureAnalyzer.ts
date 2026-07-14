import * as path from 'path';
import { ArchitectureLayer, DependencyRelation, IProjectAnalyzer } from '../shared/intelligenceTypes';

export interface ArchitectureAnalysisResult {
    type: string;
    confidence: number;
    layers: ArchitectureLayer[];
    violations: string[];
}

export class ArchitectureAnalyzer implements IProjectAnalyzer {
    public async analyze(workspaceRoot: string, filePaths: string[]): Promise<ArchitectureAnalysisResult> {
        const relativePaths = filePaths.map((p) => path.relative(workspaceRoot, p).replace(/\\/g, '/').toLowerCase());

        let type = 'Layered';
        let confidence = 0.5;
        const layers: ArchitectureLayer[] = [];

        const hasController = relativePaths.some((p) => p.includes('/controllers/'));
        const hasModel = relativePaths.some((p) => p.includes('/models/'));
        const hasView = relativePaths.some((p) => p.includes('/views/') || p.includes('/pages/'));
        const hasDomain = relativePaths.some((p) => p.includes('/domain/'));
        const hasUseCases = relativePaths.some((p) => p.includes('/usecases/'));
        const hasVscode = relativePaths.some(
            (p) => p === 'package.json' || p.endsWith('/extension.ts') || p === 'src/extension.ts'
        );

        if (hasVscode && relativePaths.some((p) => p.startsWith('src/webview/'))) {
            type = 'VS Code Extension (Webview Host)';
            confidence = 0.95;
            layers.push(
                { name: 'UI', pathPattern: 'webview-ui/**', allowedDependencies: [] },
                { name: 'Extension Host', pathPattern: 'src/**', allowedDependencies: ['Shared'] },
                { name: 'Shared', pathPattern: 'src/shared/**', allowedDependencies: [] }
            );
        } else if (hasDomain && hasUseCases) {
            type = 'Clean Architecture';
            confidence = 0.9;
            layers.push(
                { name: 'Domain', pathPattern: '**/domain/**', allowedDependencies: [] },
                { name: 'UseCases', pathPattern: '**/usecases/**', allowedDependencies: ['Domain'] },
                { name: 'Adapters', pathPattern: '**/adapters/**', allowedDependencies: ['UseCases', 'Domain'] },
                {
                    name: 'Frameworks',
                    pathPattern: '**/frameworks/**',
                    allowedDependencies: ['Adapters', 'UseCases', 'Domain']
                }
            );
        } else if (hasController && hasModel && hasView) {
            type = 'MVC (Model-View-Controller)';
            confidence = 0.85;
            layers.push(
                { name: 'Views', pathPattern: '**/views/**', allowedDependencies: ['Controllers', 'Models'] },
                { name: 'Controllers', pathPattern: '**/controllers/**', allowedDependencies: ['Models'] },
                { name: 'Models', pathPattern: '**/models/**', allowedDependencies: [] }
            );
        } else if (hasDomain) {
            type = 'DDD (Domain-Driven Design)';
            confidence = 0.8;
            layers.push(
                { name: 'Domain', pathPattern: '**/domain/**', allowedDependencies: [] },
                { name: 'Application', pathPattern: '**/application/**', allowedDependencies: ['Domain'] },
                {
                    name: 'Infrastructure',
                    pathPattern: '**/infrastructure/**',
                    allowedDependencies: ['Domain', 'Application']
                },
                {
                    name: 'Interfaces',
                    pathPattern: '**/interfaces/**',
                    allowedDependencies: ['Domain', 'Application', 'Infrastructure']
                }
            );
        }

        return {
            type,
            confidence,
            layers,
            violations: []
        };
    }

    /**
     * Katman ihlallerini tespit eden altyapı.
     */
    public checkLayerViolations(relations: DependencyRelation[], layers: ArchitectureLayer[]): string[] {
        const violations: string[] = [];
        if (layers.length === 0) return [];

        for (const rel of relations) {
            const fromLayer = this.findLayerForPath(rel.from, layers);
            const toLayer = this.findLayerForPath(rel.to, layers);

            if (fromLayer && toLayer && fromLayer.name !== toLayer.name) {
                // toLayer is allowed?
                const isAllowed = fromLayer.allowedDependencies.includes(toLayer.name);
                if (!isAllowed) {
                    violations.push(
                        `Mimari İhlal: '${fromLayer.name}' katmanı (${rel.from}), '${toLayer.name}' katmanına (${rel.to}) doğrudan bağımlı olamaz.`
                    );
                }
            }
        }

        return violations;
    }

    private findLayerForPath(filePath: string, layers: ArchitectureLayer[]): ArchitectureLayer | undefined {
        const normalizedPath = filePath.toLowerCase();
        return layers
            .filter((layer) => this.matchesLayer(normalizedPath, layer))
            .sort((a, b) => b.pathPattern.length - a.pathPattern.length)[0];
    }

    private matchesLayer(filePath: string, layer: ArchitectureLayer): boolean {
        const pattern = layer.pathPattern.toLowerCase();
        const regex = this.globToRegExp(pattern);
        return regex.test(filePath) || filePath.includes(`/${layer.name.toLowerCase()}/`);
    }

    private globToRegExp(pattern: string): RegExp {
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        const source = escaped
            .replace(/\*\*/g, '__DOUBLE_STAR__')
            .replace(/\*/g, '[^/]*')
            .replace(/__DOUBLE_STAR__/g, '.*');
        return new RegExp(`^${source}$`, 'i');
    }
}
