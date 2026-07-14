import * as path from 'path';
import { existsSync } from 'fs';
import { ProjectIntelligenceEngine } from '../../intelligence/scanner/ProjectIntelligenceEngine';

export interface WorkspaceScanResult {
    name: string;
    shortPath: string;
    hasPackageJson: boolean;
    hasReadme: boolean;
    hasSrcDir: boolean;
    stackTags: string[];
    approxFileCount: number;
    scannedAt: number;
}

export class WorkspaceScanner {
    constructor(private readonly workspaceRoot: string) {}

    public async scan(): Promise<WorkspaceScanResult> {
        const engine = new ProjectIntelligenceEngine(this.workspaceRoot);
        const engineResult = await engine.runFullScan();

        const shortPath = this.workspaceRoot.split(/[\\/]/).slice(-2).join('/');
        const hasPackageJson = existsSync(path.join(this.workspaceRoot, 'package.json'));
        const hasReadme = existsSync(path.join(this.workspaceRoot, 'README.md'));
        const hasSrcDir = existsSync(path.join(this.workspaceRoot, 'src'));
        const stackTags = Array.from(new Set(engineResult.knowledge.technologies.map((t) => t.name)));

        return {
            name: engineResult.knowledge.projectName,
            shortPath,
            hasPackageJson,
            hasReadme,
            hasSrcDir,
            stackTags,
            approxFileCount: engineResult.fileCount,
            scannedAt: Date.now()
        };
    }
}
