export type AIProviderType = 'openai' | 'gemini' | 'claude' | 'openrouter' | 'local' | 'mock';

export interface AIModel {
    id: string;
    provider: AIProviderType;
    modelName: string;
    contextWindow: number;
    maxOutput: number;
    streaming: boolean;
    reasoningSupport: boolean;
    visionSupport: boolean;
    functionCalling: boolean;
    metadata?: Record<string, any>;
}

export interface PromptSection {
    type: 'system' | 'role' | 'projectContext' | 'architectureContext' | 'memoryContext' | 'taskContext' | 'rules' | 'outputFormat' | 'validationRules' | 'reasoningContext';
    content: string;
    priority: number;
}

export interface AIChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AIGenerateRequest {
    modelId: string;
    messages: AIChatMessage[];
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    responseFormat?: 'json_object' | 'text';
}

export interface AIGenerateResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    durationMs: number;
}

export interface ProviderHealthStatus {
    provider: AIProviderType;
    status: 'healthy' | 'degraded' | 'unavailable';
    latencyMs?: number;
    lastChecked: number;
    errorCount: number;
}
