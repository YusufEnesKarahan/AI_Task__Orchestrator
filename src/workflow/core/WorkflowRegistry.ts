import { WorkflowDefinition } from '../shared/workflowTypes';
import {
    FeatureDevelopmentTemplate,
    BugFixTemplate,
    RefactorTemplate,
    CodeReviewTemplate,
    DocumentationTemplate
} from '../templates/defaultTemplates';

export class WorkflowRegistry {
    private static instance: WorkflowRegistry;
    private readonly templates = new Map<string, WorkflowDefinition>();

    private constructor() {
        this.registerDefaults();
    }

    public static getInstance(): WorkflowRegistry {
        if (!WorkflowRegistry.instance) {
            WorkflowRegistry.instance = new WorkflowRegistry();
        }
        return WorkflowRegistry.instance;
    }

    /**
     * İş akışı şablonunu kaydeder.
     */
    public register(definition: WorkflowDefinition): void {
        this.templates.set(definition.name, definition);
    }

    /**
     * Şablonu ismiyle döndürür.
     */
    public getTemplate(name: string): WorkflowDefinition | undefined {
        return this.templates.get(name);
    }

    /**
     * Tüm kayıtlı şablonları döndürür.
     */
    public getAllTemplates(): WorkflowDefinition[] {
        return Array.from(this.templates.values());
    }

    /**
     * Tüm şablonları temizler.
     */
    public clear(): void {
        this.templates.clear();
    }

    private registerDefaults() {
        this.register(FeatureDevelopmentTemplate);
        this.register(BugFixTemplate);
        this.register(RefactorTemplate);
        this.register(CodeReviewTemplate);
        this.register(DocumentationTemplate);
    }
}
