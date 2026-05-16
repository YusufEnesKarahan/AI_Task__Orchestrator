import { IAIProvider } from './interfaces/IAIProvider';
import { GeminiProvider } from './implementations/GeminiProvider';
import { MockAIProvider } from './implementations/MockAIProvider';
import { OpenAIProvider } from './implementations/OpenAIProvider';
import { ProviderSelection, ProviderRuntimeConfig } from './providerConfig';

export interface ProviderStatus {
    selection: ProviderSelection;
    active: ProviderSelection | 'none';
    available: boolean;
    severity: 'info' | 'warning' | 'error';
    label: string;
    message: string;
}

export interface ProviderBootstrapResult {
    provider?: IAIProvider;
    status: ProviderStatus;
}

export function createProvider(config: ProviderRuntimeConfig): ProviderBootstrapResult {
    switch (config.selection) {
        case 'openai':
            if (!config.apiKeys.openai) {
                return {
                    provider: undefined,
                    status: buildUnavailableStatus(
                        'openai',
                        'OpenAI selected but no API key is configured. Configure it via SecretStorage or environment variables.'
                    )
                };
            }

            return {
                provider: new OpenAIProvider({
                    apiKey: config.apiKeys.openai,
                    model: config.openAiModel,
                    timeoutMs: config.timeoutMs,
                    maxRetries: config.maxRetries
                }),
                status: {
                    selection: 'openai',
                    active: 'openai',
                    available: true,
                    severity: 'info',
                    label: 'OpenAI aktif',
                    message: `OpenAI provider active with model '${config.openAiModel}'.`
                }
            };
        case 'gemini':
            if (!config.apiKeys.gemini) {
                return {
                    provider: undefined,
                    status: buildUnavailableStatus(
                        'gemini',
                        'Gemini selected but no API key is configured. Configure it via SecretStorage or environment variables.'
                    )
                };
            }

            return {
                provider: new GeminiProvider({
                    apiKey: config.apiKeys.gemini,
                    model: config.geminiModel,
                    timeoutMs: config.timeoutMs,
                    maxRetries: config.maxRetries
                }),
                status: {
                    selection: 'gemini',
                    active: 'gemini',
                    available: true,
                    severity: 'info',
                    label: 'Gemini aktif',
                    message: `Gemini provider active with model '${config.geminiModel}'.`
                }
            };
        case 'mock':
            return {
                provider: new MockAIProvider(),
                status: {
                    selection: 'mock',
                    active: 'mock',
                    available: true,
                    severity: 'warning',
                    label: 'Mock aktif',
                    message: 'Mock provider is explicitly selected. AI results are simulated.'
                }
            };
        default:
            return {
                provider: undefined,
                status: buildUnavailableStatus(config.selection, `Unsupported provider selection: ${config.selection}`)
            };
    }
}

function buildUnavailableStatus(selection: ProviderSelection, message: string): ProviderStatus {
    return {
        selection,
        active: 'none',
        available: false,
        severity: 'error',
        label: selection === 'openai' ? 'OpenAI pasif' : 'Gemini pasif',
        message
    };
}
