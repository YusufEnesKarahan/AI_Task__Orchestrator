import { ProjectIntelligenceEngine } from '../intelligence/scanner/ProjectIntelligenceEngine';
import { MemoryEngine } from '../memory';
import { AgentContextBuilder } from './layers/AgentContextBuilder';
import { ArchitectureContextBuilder } from './layers/ArchitectureContextBuilder';
import { CodeContextBuilder } from './layers/CodeContextBuilder';
import { DecisionContextBuilder } from './layers/DecisionContextBuilder';
import { HealthContextBuilder } from './layers/HealthContextBuilder';
import { JournalContextBuilder } from './layers/JournalContextBuilder';
import { KnowledgeContextBuilder } from './layers/KnowledgeContextBuilder';
import { ProjectContextBuilder } from './layers/ProjectContextBuilder';
import { RiskContextBuilder } from './layers/RiskContextBuilder';
import { StaticContextBuilder } from './layers/StaticContextBuilder';
import { TaskContextBuilder } from './layers/TaskContextBuilder';
import { WorkingContextBuilder } from './layers/WorkingContextBuilder';
import { ContextBudgetManager } from './ContextBudgetManager';
import { ContextCache } from './ContextCache';
import { ContextScorer } from './ContextScorer';
import { ContextSelector } from './ContextSelector';
import { ContextValidator } from './ContextValidator';
import {
    AgentProfile,
    BuildContextInput,
    ContextItem,
    ContextLayer,
    ContextLayerBuilder,
    ContextPackage,
    ContextSourceBundle,
    ContextValidationResult
} from './types';

export class ContextEngine {
    private readonly memoryEngine: MemoryEngine;
    private readonly intelligenceEngine: ProjectIntelligenceEngine;
    private readonly selector = new ContextSelector();
    private readonly scorer = new ContextScorer();
    private readonly budgetManager = new ContextBudgetManager();
    private readonly cache: ContextCache;
    private readonly validator = new ContextValidator();
    private readonly builders: Record<ContextLayer, ContextLayerBuilder>;

    constructor(private readonly workspaceRoot: string) {
        this.memoryEngine = new MemoryEngine(workspaceRoot);
        this.intelligenceEngine = new ProjectIntelligenceEngine(workspaceRoot);
        this.cache = new ContextCache(workspaceRoot);
        this.builders = {
            static: new StaticContextBuilder(),
            project: new ProjectContextBuilder(),
            task: new TaskContextBuilder(),
            working: new WorkingContextBuilder(),
            decision: new DecisionContextBuilder(),
            journal: new JournalContextBuilder(),
            code: new CodeContextBuilder(),
            knowledge: new KnowledgeContextBuilder(),
            architecture: new ArchitectureContextBuilder(),
            risk: new RiskContextBuilder(),
            health: new HealthContextBuilder(),
            agent: new AgentContextBuilder()
        };
    }

    public async buildContext(input: BuildContextInput = {}): Promise<ContextPackage> {
        const normalizedInput = this.normalizeInput(input);
        const cacheKey = this.cache.createCacheKey(normalizedInput);
        const sources = await this.loadSources();
        const sourceFingerprint = this.cache.createSourceFingerprint([
            sources.memory.static.updatedAt,
            sources.memory.working.updatedAt,
            sources.memory.decisions.updatedAt,
            sources.memory.journal.updatedAt,
            sources.knowledge.workspaceHash,
            sources.health,
            sources.risk
        ]);

        if (!normalizedInput.forceRefresh) {
            const cached = await this.cache.get(cacheKey, sourceFingerprint);
            if (cached) {
                return cached;
            }
        }

        const selectedLayers = this.selector.selectLayers(normalizedInput);
        const rawItems = await this.buildItems(selectedLayers, normalizedInput, sources);
        const dedupedItems = this.dedupeItems(rawItems);
        const scoredItems = this.scorer.scoreContext(dedupedItems, normalizedInput);
        const { included, excluded } = this.budgetManager.applyBudget(scoredItems, normalizedInput.budget || 'medium');
        const context = this.createPackage(normalizedInput, sources, cacheKey, included, excluded);
        const validation = this.validator.validateContext(context);
        const finalContext = {
            ...context,
            warnings: validation.warnings
        };

        await this.cache.set(cacheKey, sourceFingerprint, finalContext);
        return finalContext;
    }

    public async buildTaskContext(task: NonNullable<BuildContextInput['task']>, input: BuildContextInput = {}) {
        return this.buildContext({ ...input, task });
    }

    public async buildProjectContext(input: BuildContextInput = {}) {
        return this.buildContext({
            ...input,
            agent: input.agent || 'architect',
            query: input.query || 'project architecture'
        });
    }

    public async buildReviewContext(input: BuildContextInput = {}) {
        return this.buildContext({
            ...input,
            agent: 'reviewer',
            task: input.task || { title: 'Review project', type: 'review' }
        });
    }

    public async buildPlannerContext(input: BuildContextInput = {}) {
        return this.buildContext({
            ...input,
            agent: 'planner',
            task: input.task || { title: 'Plan next work', type: 'planning' }
        });
    }

    public validateContext(context: ContextPackage): ContextValidationResult {
        return this.validator.validateContext(context);
    }

    public scoreContext(items: ContextItem[], input: BuildContextInput = {}): ContextItem[] {
        return this.scorer.scoreContext(items, this.normalizeInput(input));
    }

    public async clearCache(): Promise<void> {
        await this.cache.clear();
    }

    public async searchContext(query: string, input: BuildContextInput = {}): Promise<ContextItem[]> {
        const context = await this.buildContext({ ...input, query });
        const lowered = query.toLowerCase();
        return context.items.filter((item) =>
            `${item.title} ${item.content} ${item.tags.join(' ')}`.toLowerCase().includes(lowered)
        );
    }

    private async loadSources(): Promise<ContextSourceBundle> {
        const [memory, intelligence] = await Promise.all([
            this.memoryEngine.loadMemory(),
            this.intelligenceEngine.runFullScan()
        ]);

        return {
            memory,
            knowledge: intelligence.knowledge,
            architecture: intelligence.architecture,
            health: intelligence.health,
            risk: intelligence.risk,
            fileCount: intelligence.fileCount
        };
    }

    private async buildItems(
        layers: ContextLayer[],
        input: BuildContextInput,
        sources: ContextSourceBundle
    ): Promise<ContextItem[]> {
        const itemGroups = await Promise.all(layers.map((layer) => this.builders[layer].build(input, sources)));
        return itemGroups.flat();
    }

    private createPackage(
        input: BuildContextInput,
        sources: ContextSourceBundle,
        cacheKey: string,
        items: ContextItem[],
        excludedItems: ContextItem[]
    ): ContextPackage {
        const codeItem = items.find((item) => item.id === 'code:related-files');
        const codeData = (codeItem?.data || {}) as {
            relatedFiles?: string[];
            relatedModules?: string[];
            dependencies?: string[];
        };
        const budget = input.budget || 'medium';
        const tokenEstimate = items.reduce((sum, item) => sum + item.tokenEstimate, 0);

        return {
            id: `context_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
            createdAt: Date.now(),
            cacheKey,
            budget,
            tokenBudget: this.budgetManager.getTokenBudget(budget),
            tokenEstimate,
            agent: input.agent || 'planner',
            taskType: input.task?.type || 'planning',
            priority: input.task?.priority || 'medium',
            project: {
                name: sources.knowledge.projectName,
                type: sources.knowledge.projectType
            },
            architecture: {
                type: sources.knowledge.architecture.type,
                confidence: sources.knowledge.architecture.confidence
            },
            memory: {
                currentSprint: sources.memory.working.workingMemory.currentSprint,
                currentGoal: sources.memory.working.workingMemory.currentGoal,
                currentTask: sources.memory.working.workingMemory.currentTask
            },
            knowledge: {
                technologies: sources.knowledge.technologies.map((tech) => tech.name),
                modules: sources.knowledge.modules,
                knownIssues: sources.knowledge.knownIssues
            },
            relatedFiles: codeData.relatedFiles || input.task?.relatedFiles || [],
            relatedModules: codeData.relatedModules || input.task?.relatedModules || sources.knowledge.modules,
            dependencies: codeData.dependencies || [],
            knownIssues: [...sources.knowledge.knownIssues, ...sources.risk.architectureViolations],
            rules: sources.memory.static.staticMemory.codingRules,
            items,
            excludedItems,
            warnings: []
        };
    }

    private dedupeItems(items: ContextItem[]): ContextItem[] {
        const seen = new Set<string>();
        return items.filter((item) => {
            const key = `${item.layer}:${item.title}:${item.content}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    private normalizeInput(input: BuildContextInput): BuildContextInput {
        const agent: AgentProfile = input.agent || 'planner';
        return {
            ...input,
            agent,
            budget: input.budget || 'medium'
        };
    }
}
