export class ProviderError extends Error {
    public readonly provider: string;
    public readonly code: string;
    public readonly status?: number;
    public readonly retryable: boolean;
    public readonly cause?: unknown;

    constructor(input: {
        provider: string;
        message: string;
        code: string;
        status?: number;
        retryable?: boolean;
        cause?: unknown;
    }) {
        super(input.message);
        this.name = 'ProviderError';
        this.provider = input.provider;
        this.code = input.code;
        this.status = input.status;
        this.retryable = input.retryable ?? false;
        this.cause = input.cause;
    }
}
