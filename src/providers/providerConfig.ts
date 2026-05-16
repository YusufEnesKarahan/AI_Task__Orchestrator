import * as vscode from 'vscode';

export type ProviderSelection = 'openai' | 'gemini' | 'mock';

export interface ProviderRuntimeConfig {
    selection: ProviderSelection;
    openAiModel: string;
    geminiModel: string;
    timeoutMs: number;
    maxRetries: number;
    apiKeys: {
        openai?: string;
        gemini?: string;
    };
}

export const PROVIDER_SECRET_KEYS = {
    openai: 'ai-task-orchestrator.openai-api-key',
    gemini: 'ai-task-orchestrator.gemini-api-key'
} as const;

export async function loadProviderRuntimeConfig(context: vscode.ExtensionContext): Promise<ProviderRuntimeConfig> {
    const config = vscode.workspace.getConfiguration('aiTaskOrchestrator');

    return {
        selection: config.get<ProviderSelection>('provider', 'openai'),
        openAiModel: config.get<string>('openAiModel', 'gpt-4o-mini'),
        geminiModel: config.get<string>('geminiModel', 'gemini-1.5-flash'),
        timeoutMs: config.get<number>('timeoutMs', 30000),
        maxRetries: config.get<number>('maxRetries', 2),
        apiKeys: {
            openai: await resolveApiKey(context.secrets, PROVIDER_SECRET_KEYS.openai, process.env.OPENAI_API_KEY),
            gemini: await resolveApiKey(context.secrets, PROVIDER_SECRET_KEYS.gemini, process.env.GEMINI_API_KEY)
        }
    };
}

async function resolveApiKey(
    secrets: vscode.SecretStorage,
    secretKey: string,
    environmentValue?: string
): Promise<string | undefined> {
    const storedValue = (await secrets.get(secretKey))?.trim();
    if (storedValue) {
        return storedValue;
    }

    const envValue = environmentValue?.trim();
    return envValue || undefined;
}
