import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as path from 'path';
import { ProjectStructureAnalyzer } from '../project/ProjectStructureAnalyzer';
import { TechnologyAnalyzer } from '../technology/TechnologyAnalyzer';
import { DependencyAnalyzer } from '../dependency/DependencyAnalyzer';
import { ArchitectureAnalyzer } from '../architecture/ArchitectureAnalyzer';
import { CodeHealthAnalyzer } from '../health/CodeHealthAnalyzer';
import { RiskAnalyzer } from '../risk/RiskAnalyzer';
import { KnowledgeBaseManager } from '../knowledge/KnowledgeBaseManager';
import { ProjectSummaryGenerator } from '../summary/ProjectSummaryGenerator';
import { AIOSArchitectureMap, AIOSHealthReport, AIOSKnowledge, AIOSRiskReport } from '../shared/intelligenceTypes';

export interface FullScanResult {
    knowledge: AIOSKnowledge;
    architecture: AIOSArchitectureMap;
    health: AIOSHealthReport;
    risk: AIOSRiskReport;
    fileCount: number;
}

const EXCLUDED_DIRS = new Set([
    'node_modules',
    '.git',
    'out',
    'out-test',
    'dist',
    'build',
    'coverage',
    '.vscode',
    '.aios',
    '.github'
]);

export class ProjectIntelligenceEngine {
    private readonly workspaceRoot: string;
    private readonly structureAnalyzer = new ProjectStructureAnalyzer();
    private readonly techAnalyzer = new TechnologyAnalyzer();
    private readonly depAnalyzer = new DependencyAnalyzer();
    private readonly archAnalyzer = new ArchitectureAnalyzer();
    private readonly healthAnalyzer = new CodeHealthAnalyzer();
    private readonly riskAnalyzer = new RiskAnalyzer();
    private readonly kbManager: KnowledgeBaseManager;
    private readonly summaryGen: ProjectSummaryGenerator;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.kbManager = new KnowledgeBaseManager(workspaceRoot);
        this.summaryGen = new ProjectSummaryGenerator(workspaceRoot);
    }

    public async runFullScan(): Promise<FullScanResult> {
        const filePaths = await this.listAllFiles(this.workspaceRoot);
        const fileCount = filePaths.length;

        // 1. Structure
        const folderStructure = await this.structureAnalyzer.analyze(this.workspaceRoot, filePaths);

        // 2. Technology
        const technologies = await this.techAnalyzer.analyze(this.workspaceRoot, filePaths);

        // 3. Dependencies
        const dependencies = await this.depAnalyzer.analyze(this.workspaceRoot, filePaths);
        const circularDependencies = this.depAnalyzer.detectCircularDependencies(dependencies);

        // 4. Architecture
        const archResult = await this.archAnalyzer.analyze(this.workspaceRoot, filePaths);
        const violations = this.archAnalyzer.checkLayerViolations(dependencies, archResult.layers);

        // 5. Health
        const healthReport = await this.healthAnalyzer.analyze(this.workspaceRoot, filePaths);

        // 6. Risks
        const riskReport = await this.riskAnalyzer.analyze(this.workspaceRoot, filePaths);
        riskReport.circularDependencies = circularDependencies;
        riskReport.architectureViolations = violations;

        // 7. Assemble Knowledge Base
        const projectName = path.basename(this.workspaceRoot);
        const projectType = technologies.some((t) => t.name === 'VS Code Extension API')
            ? 'VS Code Extension'
            : technologies.some((t) => t.name === 'React' || t.name === 'Vue')
              ? 'Frontend Web Application'
              : 'NodeJS Project';

        const modules = this.extractModules(filePaths, dependencies);
        const relativeFilePaths = filePaths.map((p) => path.relative(this.workspaceRoot, p).replace(/\\/g, '/'));
        const knownIssues = [
            ...violations,
            ...circularDependencies.map((cycle) => `Circular dependency: ${cycle.join(' -> ')}`)
        ];

        const knowledge: AIOSKnowledge = {
            projectName,
            projectType,
            technologies,
            architecture: {
                type: archResult.type,
                confidence: archResult.confidence
            },
            folderStructure,
            modules,
            dependencies,
            services: relativeFilePaths.filter((p) => p.toLowerCase().includes('service')),
            routes: relativeFilePaths.filter((p) => p.toLowerCase().includes('route')),
            database: {
                type: this.detectDatabaseType(technologies),
                tables: []
            },
            knownIssues,
            generatedTime: Date.now(),
            workspaceHash: await this.computeWorkspaceHash(filePaths)
        };

        const archMap: AIOSArchitectureMap = {
            layers: archResult.layers,
            modules,
            relations: dependencies,
            entryPoints: relativeFilePaths.filter(
                (p) => p.endsWith('extension.ts') || p.endsWith('index.ts') || p.endsWith('main.ts')
            ),
            serviceConnections: []
        };

        // Save metadata to .aios/
        await this.kbManager.saveKnowledgeBase(knowledge);
        await this.kbManager.saveArchitectureMap(archMap);
        await this.kbManager.saveHealthReport(healthReport);
        await this.kbManager.saveRiskReport(riskReport);

        // Save Summary report (summary.md)
        await this.summaryGen.generateAndSave(knowledge, archMap, healthReport, riskReport);

        return {
            knowledge,
            architecture: archMap,
            health: healthReport,
            risk: riskReport,
            fileCount
        };
    }

    /**
     * İleride değişen dosyalar için artan (incremental) tarama desteği arayüzü.
     */
    public async runIncrementalScan(changedFiles: string[]): Promise<Partial<FullScanResult>> {
        // Placeholder implementasyon; arayüz hazır
        void changedFiles;
        return {};
    }

    private extractModules(filePaths: string[], dependencies: Array<{ from: string }>): string[] {
        const modules = new Set<string>();

        for (const filePath of filePaths) {
            const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
            const [firstPart] = relativePath.split('/');
            if (firstPart && !firstPart.includes('.')) {
                modules.add(firstPart);
            }
        }

        for (const dependency of dependencies) {
            const [firstPart] = dependency.from.split('/');
            if (firstPart) {
                modules.add(firstPart);
            }
        }

        return Array.from(modules).sort();
    }

    private detectDatabaseType(technologies: Array<{ name: string }>): string {
        if (technologies.some((t) => t.name === 'Prisma' || t.name === 'Sequelize')) {
            return 'SQL/ORM';
        }
        if (technologies.some((t) => t.name === 'Mongoose')) {
            return 'MongoDB/ODM';
        }
        return 'No Database';
    }

    private async computeWorkspaceHash(filePaths: string[]): Promise<string> {
        const hash = crypto.createHash('sha256');
        const sortedPaths = [...filePaths].sort();

        for (const filePath of sortedPaths) {
            const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
            try {
                const stat = await fs.stat(filePath);
                hash.update(`${relativePath}:${stat.size}:${Math.floor(stat.mtimeMs)}\n`);
            } catch {
                hash.update(`${relativePath}:missing\n`);
            }
        }

        return hash.digest('hex');
    }

    private async listAllFiles(dir: string): Promise<string[]> {
        let results: string[] = [];
        try {
            const list = await fs.readdir(dir, { withFileTypes: true });
            for (const file of list) {
                if (file.name.startsWith('.') && file.isDirectory()) continue;
                if (EXCLUDED_DIRS.has(file.name)) continue;

                const fullPath = path.join(dir, file.name);
                if (file.isDirectory()) {
                    const subFiles = await this.listAllFiles(fullPath);
                    results = results.concat(subFiles);
                } else {
                    results.push(fullPath);
                }
            }
        } catch {}
        return results;
    }
}
