import { AIGenerateRequest, AIGenerateResponse, AIProviderType, ProviderHealthStatus } from '../shared/aiTypes';
import { SecretManager } from '../shared/SecretManager';
import { ModelRegistry } from '../registry/ModelRegistry';

// Bu aşamada BaseAIProvider ve spesifik providerların importları,
// projenin mevcut refaktör edilmiş yapısından alınacak.
// Gelecekte providerlar doğrudan ProviderRouter tarafından yönetilecek.
import { IAIProvider, AIProviderTextRequest, ProviderHealthStatus as CoreProviderHealthStatus } from '../../providers/interfaces/IAIProvider';
import { OpenAIProvider } from '../../providers/implementations/OpenAIProvider';
import { GeminiProvider } from '../../providers/implementations/GeminiProvider';
import { AIProviderConfig } from '../../providers/interfaces/IAIProvider';

export class ProviderRouter {
    private static instance: ProviderRouter;
    private readonly providerInstances = new Map<string, IAIProvider>();

    private constructor() {}

    public static getInstance(): ProviderRouter {
        if (!ProviderRouter.instance) {
            ProviderRouter.instance = new ProviderRouter();
        }
        return ProviderRouter.instance;
    }

    public async route(request: AIGenerateRequest): Promise<AIGenerateResponse> {
        const startTime = Date.now();
        const modelInfo = ModelRegistry.getInstance().getModel(request.modelId);
        
        if (!modelInfo) {
            throw new Error(`[ProviderRouter] Unknown model ID: ${request.modelId}`);
        }

        const provider = await this.getOrCreateProvider(modelInfo.provider, modelInfo.modelName);
        
        // Convert chat messages to single prompt string for current BaseAIProvider compatibility
        const promptString = request.messages
            .map(m => `${m.role.toUpperCase()}:\n${m.content}`)
            .join('\n\n');

        const textRequest: AIProviderTextRequest = {
            prompt: promptString,
            temperature: request.temperature,
            maxTokens: request.maxTokens
        };

        const resultText = await provider.generateText(textRequest);
        const durationMs = Date.now() - startTime;

        return {
            content: resultText,
            durationMs,
            // Mock usage for now, since BaseAIProvider currently returns plain string. 
            // Gelecekte BaseAIProvider güncellenerek bu veriler eklenecektir.
            usage: {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0
            }
        };
    }

    public async checkHealth(providerType: AIProviderType, modelName: string): Promise<ProviderHealthStatus> {
        try {
            const provider = await this.getOrCreateProvider(providerType, modelName);
            const status: CoreProviderHealthStatus = await provider.testConnection();
            return {
                provider: providerType,
                status: status.ok ? 'healthy' : 'unavailable',
                latencyMs: 0,
                lastChecked: Date.now(),
                errorCount: status.ok ? 0 : 1
            };
        } catch (error) {
            return {
                provider: providerType,
                status: 'unavailable',
                lastChecked: Date.now(),
                errorCount: 1
            };
        }
    }

    private async getOrCreateProvider(providerType: AIProviderType, modelName: string): Promise<IAIProvider> {
        const instanceKey = `${providerType}-${modelName}`;
        if (this.providerInstances.has(instanceKey)) {
            return this.providerInstances.get(instanceKey)!;
        }

        const apiKey = await SecretManager.getInstance().getApiKey(providerType);
        if (!apiKey && providerType !== 'mock' && providerType !== 'local') {
            throw new Error(`[ProviderRouter] Missing API key for provider: ${providerType}`);
        }

        const config: AIProviderConfig = {
            model: modelName,
            apiKey: apiKey || 'mock-key'
        };

        let provider: IAIProvider;
        switch (providerType) {
            case 'openai':
                provider = new OpenAIProvider(config);
                break;
            case 'gemini':
                provider = new GeminiProvider(config);
                break;
            case 'mock':
                // Creating a dummy provider for testing
                provider = {
                    providerName: 'mock',
                    model: modelName,
                    generateText: async () => 'Mock response',
                    generateJSON: async () => ({} as any),
                    testConnection: async () => ({ ok: true, provider: 'mock' })
                };
                break;
            default:
                throw new Error(`[ProviderRouter] Unsupported provider type: ${providerType}`);
        }

        this.providerInstances.set(instanceKey, provider);
        return provider;
    }
}
