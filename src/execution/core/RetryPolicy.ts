import { RetryConfig } from '../shared/executionTypes';

export class RetryPolicy {
    constructor(private readonly config: RetryConfig = { maxRetries: 3, backoffMs: 100 }) {}

    /**
     * Verilen asenkron işlemi hata durumunda belirlenen deneme limitine kadar yineler.
     */
    public async execute<T>(
        operation: () => Promise<T>, 
        onRetry?: (attempt: number, error: any) => void
    ): Promise<T> {
        let attempt = 0;
        while (true) {
            try {
                return await operation();
            } catch (error) {
                attempt++;
                if (attempt > this.config.maxRetries) {
                    throw error;
                }
                if (onRetry) {
                    onRetry(attempt, error);
                }
                // Üstel geri çekilme (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, this.config.backoffMs * attempt));
            }
        }
    }
}
