import { AIModel, AIProviderType } from '../shared/aiTypes';

export class ModelRegistry {
    private static instance: ModelRegistry;
    private readonly models = new Map<string, AIModel>();

    private constructor() {
        this.registerDefaultModels();
    }

    public static getInstance(): ModelRegistry {
        if (!ModelRegistry.instance) {
            ModelRegistry.instance = new ModelRegistry();
        }
        return ModelRegistry.instance;
    }

    private registerDefaultModels() {
        this.register({
            id: 'gpt-4o-mini',
            provider: 'openai',
            modelName: 'gpt-4o-mini',
            contextWindow: 128000,
            maxOutput: 16384,
            streaming: true,
            reasoningSupport: false,
            visionSupport: true,
            functionCalling: true
        });

        this.register({
            id: 'gpt-4o',
            provider: 'openai',
            modelName: 'gpt-4o',
            contextWindow: 128000,
            maxOutput: 16384,
            streaming: true,
            reasoningSupport: false,
            visionSupport: true,
            functionCalling: true
        });

        this.register({
            id: 'gemini-2.5-flash',
            provider: 'gemini',
            modelName: 'gemini-2.5-flash',
            contextWindow: 1048576,
            maxOutput: 8192,
            streaming: true,
            reasoningSupport: false,
            visionSupport: true,
            functionCalling: true
        });

        this.register({
            id: 'gemini-2.0-pro-exp-02-05',
            provider: 'gemini',
            modelName: 'gemini-2.0-pro-exp-02-05',
            contextWindow: 2097152,
            maxOutput: 8192,
            streaming: true,
            reasoningSupport: true,
            visionSupport: true,
            functionCalling: true
        });
        
        this.register({
            id: 'claude-3-5-sonnet',
            provider: 'claude',
            modelName: 'claude-3-5-sonnet-20241022',
            contextWindow: 200000,
            maxOutput: 8192,
            streaming: true,
            reasoningSupport: false,
            visionSupport: true,
            functionCalling: true
        });
        
        this.register({
            id: 'mock-model',
            provider: 'mock',
            modelName: 'mock-model',
            contextWindow: 8192,
            maxOutput: 1024,
            streaming: false,
            reasoningSupport: false,
            visionSupport: false,
            functionCalling: false
        });
    }

    public register(model: AIModel): void {
        this.models.set(model.id, model);
    }

    public getModel(id: string): AIModel | undefined {
        return this.models.get(id);
    }

    public getModelsByProvider(provider: AIProviderType): AIModel[] {
        return Array.from(this.models.values()).filter(m => m.provider === provider);
    }

    public getAllModels(): AIModel[] {
        return Array.from(this.models.values());
    }
}
