import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { DependencyRelation, IProjectAnalyzer } from '../shared/intelligenceTypes';

interface ExtractedDependency {
    specifier: string;
    type: 'import' | 'require';
}

export class DependencyAnalyzer implements IProjectAnalyzer {
    private readonly maxLinesToRead = 100; // Optimize: imports are at the top

    public async analyze(workspaceRoot: string, filePaths: string[]): Promise<DependencyRelation[]> {
        const relations: DependencyRelation[] = [];
        const codeFiles = filePaths.filter((p) => /\.(ts|tsx|js|jsx)$/.test(p));

        for (const filePath of codeFiles) {
            const fromRelative = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
            try {
                const content = await this.readFileHead(filePath);
                const imports = this.extractImports(content);

                for (const imp of imports) {
                    let resolvedTo = imp.specifier;

                    // Göreli (relative) yolları çözümle
                    if (imp.specifier.startsWith('.')) {
                        const dir = path.dirname(filePath);
                        const absoluteTo = path.resolve(dir, imp.specifier);
                        resolvedTo = path.relative(workspaceRoot, absoluteTo).replace(/\\/g, '/');

                        // Dosya uzantısını eklemeye çalış
                        resolvedTo = this.resolveFileExtension(workspaceRoot, resolvedTo);
                    }

                    relations.push({
                        from: fromRelative,
                        to: resolvedTo,
                        type: imp.specifier.startsWith('.') ? imp.type : 'external'
                    });
                }
            } catch (e) {
                console.error(`Dependency scan failed for file ${fromRelative}:`, e);
            }
        }

        return relations;
    }

    private async readFileHead(filePath: string): Promise<string> {
        const fileHandle = await fs.open(filePath, 'r');
        try {
            const buffer = Buffer.alloc(this.maxLinesToRead * 120);
            const { bytesRead } = await fileHandle.read(buffer, 0, buffer.length, 0);
            const content = buffer.toString('utf8', 0, bytesRead);
            return content.split(/\r?\n/).slice(0, this.maxLinesToRead).join('\n');
        } finally {
            await fileHandle.close();
        }
    }

    private extractImports(content: string): ExtractedDependency[] {
        const imports: ExtractedDependency[] = [];
        const seen = new Set<string>();

        const add = (specifier: string, type: 'import' | 'require') => {
            const key = `${type}:${specifier}`;
            if (!seen.has(key)) {
                seen.add(key);
                imports.push({ specifier, type });
            }
        };

        // Match: import ... from 'path', import 'path', export ... from 'path'
        const importRegex =
            /(?:import|export)\s+?(?:(?:(?:type\s+)?(?:[\w*\s{},]*)\s+from\s+?)|)(?:(?:["'])(.*?)(?:["']))/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            if (match[1]) {
                add(match[1], 'import');
            }
        }

        // Match: require('path')
        const requireRegex = /require\((?:["'])(.*?)(?:["'])\)/g;
        while ((match = requireRegex.exec(content)) !== null) {
            if (match[1]) {
                add(match[1], 'require');
            }
        }

        return imports;
    }

    private resolveFileExtension(workspaceRoot: string, relativePath: string): string {
        const candidates = [
            relativePath,
            `${relativePath}.ts`,
            `${relativePath}.tsx`,
            `${relativePath}.js`,
            `${relativePath}.jsx`,
            `${relativePath}/index.ts`,
            `${relativePath}/index.js`
        ];

        for (const candidate of candidates) {
            const absolutePath = path.resolve(workspaceRoot, candidate);
            if (existsSync(absolutePath)) {
                return candidate;
            }
        }

        return relativePath;
    }

    /**
     * Döngüsel bağımlılıkları (Circular Dependencies) algılamak için DFS algoritması altyapısı.
     */
    public detectCircularDependencies(relations: DependencyRelation[]): string[][] {
        const graph = new Map<string, string[]>();
        for (const rel of relations) {
            if (rel.type === 'import' || rel.type === 'require') {
                if (!graph.has(rel.from)) graph.set(rel.from, []);
                graph.get(rel.from)!.push(rel.to);
            }
        }

        const cycles: string[][] = [];
        const visited = new Set<string>();
        const stack = new Set<string>();
        const pathTracker: string[] = [];

        const dfs = (node: string) => {
            if (stack.has(node)) {
                const cycleStartIdx = pathTracker.indexOf(node);
                cycles.push([...pathTracker.slice(cycleStartIdx), node]);
                return;
            }
            if (visited.has(node)) return;

            visited.add(node);
            stack.add(node);
            pathTracker.push(node);

            const neighbors = graph.get(node) || [];
            for (const neighbor of neighbors) {
                dfs(neighbor);
            }

            pathTracker.pop();
            stack.delete(node);
        };

        for (const node of graph.keys()) {
            dfs(node);
        }

        return cycles;
    }
}
