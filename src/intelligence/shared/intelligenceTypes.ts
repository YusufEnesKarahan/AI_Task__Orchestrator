export interface TechnologyInfo {
    name: string;
    confidence: number;
    type: string;
}

export interface FolderStructureNode {
    path: string;
    type: 'directory' | 'file';
    role?: string;
    children?: FolderStructureNode[];
}

export interface DependencyRelation {
    from: string;
    to: string;
    type: 'import' | 'require' | 'external';
}

export interface ArchitectureLayer {
    name: string;
    pathPattern: string;
    allowedDependencies: string[];
}

export interface AIOSKnowledge {
    projectName: string;
    projectType: string;
    technologies: TechnologyInfo[];
    architecture: {
        type: string;
        confidence: number;
    };
    folderStructure: FolderStructureNode[];
    modules: string[];
    dependencies: DependencyRelation[];
    services: string[];
    routes: string[];
    database: {
        type: string;
        tables: string[];
    };
    knownIssues: string[];
    generatedTime: number;
    workspaceHash: string;
}

export interface AIOSArchitectureMap {
    layers: ArchitectureLayer[];
    modules: string[];
    relations: DependencyRelation[];
    entryPoints: string[];
    serviceConnections: Array<{ from: string; to: string }>;
}

export interface AIOSHealthReport {
    architectureScore: number;
    maintainability: number;
    complexity: number;
    documentation: number;
    testing: number;
    performance: number;
    security: number;
    technicalDebt: number;
}

export interface AIOSRiskReport {
    deadCode: string[];
    duplicateCode: string[];
    largeFiles: string[];
    largeComponents: string[];
    unusedImports: string[];
    unusedFiles: string[];
    circularDependencies: string[][];
    architectureViolations: string[];
    longFunctions: string[];
    largeClasses: string[];
    magicNumbers: string[];
    hardcodedStrings: string[];
}

export interface IProjectAnalyzer {
    analyze(workspaceRoot: string, filePaths: string[]): Promise<any>;
    analyzeIncremental?(changedFiles: string[]): Promise<any>;
}
