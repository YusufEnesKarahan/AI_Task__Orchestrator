import { BaseAIProvider } from '../BaseAIProvider';
import { AIProviderConfig, AIProviderTextRequest, ProviderHealthStatus } from '../interfaces/IAIProvider';

export class GeminiProvider extends BaseAIProvider {
    constructor(config: AIProviderConfig) {
        super('Gemini', {
            ...config,
            baseUrl: config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta'
        });
    }

    public async generateText(request: AIProviderTextRequest): Promise<string> {
        return this.executeWithRetry(async () => {
            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemInstruction: request.systemPrompt
                            ? { parts: [{ text: request.systemPrompt }] }
                            : undefined,
                        generationConfig: {
                            temperature: request.temperature,
                            maxOutputTokens: request.maxTokens
                        },
                        contents: [
                            {
                                role: 'user',
                                parts: [{ text: request.prompt }]
                            }
                        ]
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw this.createHttpError(response.status, this.formatGeminiHttpError(errorText));
            }

            const data = (await response.json()) as {
                candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            };

            return (data.candidates?.[0]?.content?.parts || [])
                .map((part) => part.text || '')
                .join('')
                .trim();
        });
    }

    public async testConnection(): Promise<ProviderHealthStatus> {
        try {
            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/models?key=${encodeURIComponent(this.apiKey)}`,
                { method: 'GET' }
            );

            return {
                ok: response.ok,
                provider: this.providerName,
                message: response.ok ? 'Connection successful.' : `HTTP ${response.status}`
            };
        } catch (error) {
            const normalized = this.normalizeError(error);
            return {
                ok: false,
                provider: this.providerName,
                message: normalized.message
            };
        }
    }

    private formatGeminiHttpError(errorText: string): string {
        const normalized = errorText.toLowerCase();
        if (normalized.includes('not found') || normalized.includes('not supported for generatecontent')) {
            return [
                'Model bulunamadı veya bu API sürümüyle uyumsuz.',
                'Gemini model ayarını kontrol edin.',
                `Model: ${this.model}`
            ].join(' ');
        }

        return errorText || 'Gemini request failed.';
    }
}
