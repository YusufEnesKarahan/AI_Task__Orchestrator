import type { ZodType } from 'zod';

export interface AIProviderTextRequest {
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
}

export interface AIProviderJsonRequest<T = unknown> extends AIProviderTextRequest {
    schemaHint?: string;
    schema?: ZodType<T, any, unknown>;
    schemaName?: string;
}

export interface AIProviderConfig {
    apiKey?: string;
    model: string;
    timeoutMs?: number;
    maxRetries?: number;
    baseUrl?: string;
}

export interface ProviderHealthStatus {
    ok: boolean;
    provider: string;
    message?: string;
}

export interface IAIProvider {
    readonly providerName: string;
    readonly model: string;

    generateText(request: AIProviderTextRequest): Promise<string>;
    generateJSON<T>(request: AIProviderJsonRequest<T>): Promise<T>;
    testConnection(): Promise<ProviderHealthStatus>;
}
