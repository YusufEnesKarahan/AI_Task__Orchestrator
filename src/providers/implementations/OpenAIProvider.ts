import { BaseAIProvider } from '../BaseAIProvider';
import {
    AIProviderConfig,
    AIProviderJsonRequest,
    AIProviderTextRequest,
    ProviderHealthStatus
} from '../interfaces/IAIProvider';

export class OpenAIProvider extends BaseAIProvider {
    constructor(config: AIProviderConfig) {
        super('OpenAI', {
            ...config,
            baseUrl: config.baseUrl || 'https://api.openai.com/v1'
        });
    }

    public async generateText(request: AIProviderTextRequest): Promise<string> {
        return this.executeWithRetry(async () => {
            const response = await this.fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: this.buildHeaders(),
                body: JSON.stringify({
                    model: this.model,
                    temperature: request.temperature,
                    max_tokens: request.maxTokens,
                    messages: this.buildMessages(request.prompt, request.systemPrompt)
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw this.createHttpError(response.status, errorText || 'OpenAI request failed.');
            }

            const data = await response.json() as {
                choices?: Array<{
                    message?: {
                        content?: string | Array<{ type?: string; text?: string }>;
                    };
                }>;
            };

            return this.mapTextResponse(data);
        });
    }

    public async generateJSON<T>(request: AIProviderJsonRequest<T>): Promise<T> {
        const text = await this.generateText({
            ...request,
            prompt: [
                request.prompt,
                request.schemaHint ? `Return JSON matching this schema hint: ${request.schemaHint}` : 'Return valid JSON only.'
            ].join('\n\n')
        });

        return this.parseAndValidateJson(text, request);
    }

    public async testConnection(): Promise<ProviderHealthStatus> {
        try {
            const response = await this.fetchWithTimeout(`${this.baseUrl}/models`, {
                method: 'GET',
                headers: this.buildHeaders()
            });

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

    private buildHeaders(): HeadersInit {
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`
        };
    }

    private buildMessages(prompt: string, systemPrompt?: string) {
        const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        messages.push({ role: 'user', content: prompt });
        return messages;
    }

    private mapTextResponse(data: {
        choices?: Array<{
            message?: {
                content?: string | Array<{ type?: string; text?: string }>;
            };
        }>;
    }): string {
        const content = data.choices?.[0]?.message?.content;

        if (typeof content === 'string') {
            return content;
        }

        if (Array.isArray(content)) {
            return content
                .map(part => part.text || '')
                .join('')
                .trim();
        }

        return '';
    }
}
