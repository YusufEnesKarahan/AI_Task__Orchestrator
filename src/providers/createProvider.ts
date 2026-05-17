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
                        `OpenAI seçili ama API key yapılandırılmamış. Komut panelinden "AI Task Orchestrator: Set OpenAI API Key" komutunu çalıştırın.`
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
                    label: `OpenAI · ${config.openAiModel}`,
                    message: `OpenAI sağlayıcısı aktif. Model: ${config.openAiModel}`
                }
            };
        case 'gemini':
            if (!config.apiKeys.gemini) {
                return {
                    provider: undefined,
                    status: buildUnavailableStatus(
                        'gemini',
                        `Gemini seçili ama API key yapılandırılmamış. Komut panelinden "AI Task Orchestrator: Set Gemini API Key" komutunu çalıştırın.`
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
                    label: `Gemini · ${config.geminiModel}`,
                    message: `Gemini sağlayıcısı aktif. Model: ${config.geminiModel}`
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
                    label: 'Mock · Simülasyon',
                    message: 'Mock sağlayıcı aktif — AI yanıtları simüledir, gerçek istek yapılmaz.'
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
        label: `${selection === 'openai' ? 'OpenAI' : selection === 'gemini' ? 'Gemini' : selection} · API Key Eksik`,
        message
    };
}
