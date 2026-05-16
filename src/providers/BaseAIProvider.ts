import { ProviderError } from './ProviderError';
import {
    AIProviderConfig,
    AIProviderJsonRequest,
    AIProviderTextRequest,
    IAIProvider,
    ProviderHealthStatus
} from './interfaces/IAIProvider';

export abstract class BaseAIProvider implements IAIProvider {
    public readonly providerName: string;
    public readonly model: string;

    protected readonly apiKey: string;
    protected readonly timeoutMs: number;
    protected readonly maxRetries: number;
    protected readonly baseUrl?: string;

    constructor(providerName: string, config: AIProviderConfig) {
        const resolvedApiKey = config.apiKey?.trim();

        if (!resolvedApiKey) {
            throw new ProviderError({
                provider: providerName,
                code: 'missing_api_key',
                message: `${providerName} API key is missing. Supply it from VS Code SecretStorage, environment variables, or secure runtime config.`
            });
        }

        this.providerName = providerName;
        this.model = config.model;
        this.apiKey = resolvedApiKey;
        this.timeoutMs = config.timeoutMs ?? 30000;
        this.maxRetries = config.maxRetries ?? 2;
        this.baseUrl = config.baseUrl;
    }

    public abstract generateText(request: AIProviderTextRequest): Promise<string>;
    public abstract generateJSON<T>(request: AIProviderJsonRequest<T>): Promise<T>;
    public abstract testConnection(): Promise<ProviderHealthStatus>;

    protected async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
        let attempt = 0;
        let lastError: unknown;

        while (attempt <= this.maxRetries) {
            try {
                return await operation();
            } catch (error) {
                lastError = this.normalizeError(error);
                const providerError = lastError as ProviderError;

                if (!providerError.retryable || attempt === this.maxRetries) {
                    throw providerError;
                }

                attempt += 1;
                await this.sleep(this.calculateBackoff(attempt));
            }
        }

        throw this.normalizeError(lastError);
    }

    protected async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            return await fetch(url, {
                ...init,
                signal: controller.signal
            });
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new ProviderError({
                    provider: this.providerName,
                    code: 'timeout',
                    message: `${this.providerName} request timed out after ${this.timeoutMs}ms.`,
                    retryable: true,
                    cause: error
                });
            }

            throw this.normalizeError(error);
        } finally {
            clearTimeout(timer);
        }
    }

    protected normalizeError(error: unknown): ProviderError {
        if (error instanceof ProviderError) {
            return error;
        }

        if (error instanceof Error) {
            return new ProviderError({
                provider: this.providerName,
                code: 'provider_request_failed',
                message: error.message,
                retryable: false,
                cause: error
            });
        }

        return new ProviderError({
            provider: this.providerName,
            code: 'unknown_provider_error',
            message: `${this.providerName} request failed with an unknown error.`,
            retryable: false,
            cause: error
        });
    }

    protected createHttpError(status: number, message: string): ProviderError {
        return new ProviderError({
            provider: this.providerName,
            code: `http_${status}`,
            status,
            message,
            retryable: status === 429 || status >= 500
        });
    }

    protected parseAndValidateJson<T>(raw: string, request: AIProviderJsonRequest<T>): T {
        const cleaned = this.cleanJsonResponse(raw);
        const parsed = this.parseJsonText<unknown>(cleaned);

        if (!request.schema) {
            return parsed as T;
        }

        const validation = request.schema.safeParse(parsed);
        if (validation.success) {
            return validation.data;
        }

        const summary = validation.error.issues
            .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
            .join('; ');

        this.logInvalidJsonOutput(cleaned, request.schemaName, summary);
        throw new ProviderError({
            provider: this.providerName,
            code: 'invalid_json_schema',
            message: `${this.providerName} returned JSON that does not match the expected schema${request.schemaName ? ` (${request.schemaName})` : ''}.`,
            retryable: false,
            cause: validation.error
        });
    }

    protected parseJsonText<T>(raw: string): T {
        try {
            return JSON.parse(raw) as T;
        } catch (error) {
            this.logInvalidJsonOutput(raw);
            throw new ProviderError({
                provider: this.providerName,
                code: 'invalid_json_response',
                message: `${this.providerName} returned a response that could not be parsed as JSON.`,
                retryable: false,
                cause: error
            });
        }
    }

    protected cleanJsonResponse(raw: string): string {
        const fenced = raw
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
        const firstBraceIndex = Math.min(this.findIndexOrMax(fenced, '{'), this.findIndexOrMax(fenced, '['));

        if (firstBraceIndex === Number.MAX_SAFE_INTEGER) {
            return fenced;
        }

        const candidate = fenced.slice(firstBraceIndex);
        const lastObjectIndex = candidate.lastIndexOf('}');
        const lastArrayIndex = candidate.lastIndexOf(']');
        const lastBoundaryIndex = Math.max(lastObjectIndex, lastArrayIndex);

        if (lastBoundaryIndex === -1) {
            return candidate.trim();
        }

        return candidate.slice(0, lastBoundaryIndex + 1).trim();
    }

    protected logInvalidJsonOutput(raw: string, schemaName?: string, details?: string): void {
        const preview = raw.slice(0, 500);
        console.error(`[${this.providerName}] Invalid AI JSON output${schemaName ? ` for ${schemaName}` : ''}.`, {
            details,
            preview
        });
    }

    private calculateBackoff(attempt: number): number {
        return attempt * 750;
    }

    private findIndexOrMax(value: string, search: string): number {
        const index = value.indexOf(search);
        return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
