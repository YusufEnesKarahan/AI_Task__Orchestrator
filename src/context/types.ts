import { TaskPriority, TaskType } from '../shared/types/sharedTypes';
import {
    AIOSArchitectureMap,
    AIOSHealthReport,
    AIOSKnowledge,
    AIOSRiskReport
} from '../intelligence/shared/intelligenceTypes';
import { MemorySnapshot } from '../memory';

export type ContextLayer =
    | 'static'
    | 'project'
    | 'task'
    | 'working'
    | 'decision'
    | 'journal'
    | 'code'
    | 'knowledge'
    | 'architecture'
    | 'risk'
    | 'health'
    | 'agent';

export type ContextBudget = 'small' | 'medium' | 'large' | 'unlimited';
export type AgentProfile = 'planner' | 'reviewer' | 'architect' | 'prompt_engineer' | 'memory_manager';

export interface ContextTaskInput {
    id?: string;
    title: string;
    description?: string;
    type?: TaskType | 'feature' | 'fix' | 'review' | 'planning';
    priority?: TaskPriority;
    relatedFiles?: string[];
    relatedModules?: string[];
}

export interface BuildContextInput {
    task?: ContextTaskInput;
    agent?: AgentProfile;
    budget?: ContextBudget;
    forceRefresh?: boolean;
    query?: string;
}

export interface ContextSourceBundle {
    memory: MemorySnapshot;
    knowledge: AIOSKnowledge;
    architecture: AIOSArchitectureMap;
    health: AIOSHealthReport;
    risk: AIOSRiskReport;
    fileCount: number;
}

export interface ContextItem {
    id: string;
    layer: ContextLayer;
    title: string;
    content: string;
    score: number;
    tokenEstimate: number;
    source: string;
    tags: string[];
    data?: unknown;
}

export interface ContextPackage {
    id: string;
    createdAt: number;
    cacheKey: string;
    budget: ContextBudget;
    tokenBudget: number;
    tokenEstimate: number;
    agent: AgentProfile;
    taskType: string;
    priority: TaskPriority;
    project: {
        name: string;
        type: string;
    };
    architecture: {
        type: string;
        confidence: number;
    };
    memory: {
        currentSprint?: string;
        currentGoal?: string;
        currentTask?: string;
    };
    knowledge: {
        technologies: string[];
        modules: string[];
        knownIssues: string[];
    };
    relatedFiles: string[];
    relatedModules: string[];
    dependencies: string[];
    knownIssues: string[];
    rules: string[];
    items: ContextItem[];
    excludedItems: ContextItem[];
    warnings: string[];
}

export interface ContextValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export interface ContextCacheDocument {
    schemaVersion: number;
    createdAt: number;
    updatedAt: number;
    entries: ContextCacheEntry[];
}

export interface ContextCacheEntry {
    key: string;
    createdAt: number;
    sourceFingerprint: string;
    context: ContextPackage;
}

export interface ContextSummaryDocument {
    schemaVersion: number;
    updatedAt: number;
    lastContextId?: string;
    cacheEntries: number;
    lastBudget?: ContextBudget;
    lastAgent?: AgentProfile;
    lastTaskType?: string;
    lastTokenEstimate?: number;
}

export interface ContextLayerBuilder {
    readonly layer: ContextLayer;
    build(input: BuildContextInput, sources: ContextSourceBundle): Promise<ContextItem[]>;
}
