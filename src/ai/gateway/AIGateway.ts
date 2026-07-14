import { AIGenerateRequest, AIGenerateResponse, ProviderHealthStatus } from '../shared/aiTypes';
import { ProviderRouter } from '../router/ProviderRouter';
import { ModelRegistry } from '../registry/ModelRegistry';
// AIMetrics and SessionManager will be integrated here later.

export class AIGateway {
    private static instance: AIGateway;
    private router: ProviderRouter;
    private registry: ModelRegistry;

    private constructor() {
        this.router = ProviderRouter.getInstance();
        this.registry = ModelRegistry.getInstance();
    }

    public static getInstance(): AIGateway {
        if (!AIGateway.instance) {
            AIGateway.instance = new AIGateway();
        }
        return AIGateway.instance;
    }

    /**
     * Tüm AI çağrılarının tek giriş noktası.
     * @param request Model ve mesajları içeren istek objesi.
     * @returns AI modelinden gelen yanıt.
     */
    public async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
        try {
            // Gelecekte burada PromptValidator ve AIMetrics devreye girecek
            const response = await this.router.route(request);
            
            // Gelecekte burada SessionManager kaydı yapılacak

            return response;
        } catch (error) {
            console.error('[AIGateway] Generation failed:', error);
            throw error;
        }
    }

    /**
     * Desteklenen modelleri listeler.
     */
    public getAvailableModels() {
        return this.registry.getAllModels();
    }

    /**
     * Belirli bir modelin veya genel olarak sağlayıcının sağlığını kontrol eder.
     */
    public async checkHealth(modelId: string): Promise<ProviderHealthStatus> {
        const model = this.registry.getModel(modelId);
        if (!model) {
            throw new Error(`[AIGateway] Unknown model ID for health check: ${modelId}`);
        }
        return this.router.checkHealth(model.provider, model.modelName);
    }
}
