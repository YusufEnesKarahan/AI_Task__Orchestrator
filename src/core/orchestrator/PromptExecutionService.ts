import { Prompt, PromptExecutionResult } from '../types/prompt.types';
import { IAIProvider } from '../../providers/interfaces/IAIProvider';

export interface ExecutionOptions {
    timeoutMs?: number;
    maxRetries?: number;
}

export class PromptExecutionService {
    private defaultOptions: ExecutionOptions = {
        timeoutMs: 60000, // 60 saniye
        maxRetries: 1
    };

    /**
     * Verilen prompt'u provider üzerinden çalıştırır ve telemetri metrikleri ile sonucu döner.
     */
    public async execute(
        prompt: Prompt,
        provider: IAIProvider,
        options?: ExecutionOptions
    ): Promise<PromptExecutionResult> {
        const mergedOptions = { ...this.defaultOptions, ...options };
        const executionStart = Date.now();
        let attempt = 0;
        const maxAttempts = (mergedOptions.maxRetries || 0) + 1;

        while (attempt < maxAttempts) {
            attempt++;
            try {
                const rawResponse = await this.executeWithTimeout(
                    prompt.systemPrompt,
                    prompt.content,
                    provider,
                    mergedOptions.timeoutMs
                );

                const executionEnd = Date.now();

                return {
                    rawResponse,
                    parsedSummary: this.generateSummary(rawResponse),
                    executionStart,
                    executionEnd,
                    durationMs: executionEnd - executionStart
                };
            } catch (error) {
                const isLastAttempt = attempt >= maxAttempts;
                if (isLastAttempt) {
                    const executionEnd = Date.now();
                    const errorMessage = error instanceof Error ? error.message : String(error);

                    return {
                        errorMessage: `Attempt ${attempt} failed: ${errorMessage}`,
                        executionStart,
                        executionEnd,
                        durationMs: executionEnd - executionStart
                    };
                }
                // Hata alındı ancak tekrar denenecek, döngü devam eder.
            }
        }

        // TypeScript fallback (pratikte while döngüsü içinde return edilir)
        return {
            errorMessage: 'Bilinmeyen bir hata nedeniyle yürütme tamamlanamadı.',
            executionStart,
            executionEnd: Date.now(),
            durationMs: Date.now() - executionStart
        };
    }

    private async executeWithTimeout(
        systemPrompt: string,
        promptContent: string,
        provider: IAIProvider,
        timeoutMs: number = 60000
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Timeout: Provider isteği ${timeoutMs}ms içerisinde yanıt vermedi.`));
            }, timeoutMs);

            provider
                .generateText({ systemPrompt, prompt: promptContent })
                .then((response) => {
                    clearTimeout(timeoutId);
                    resolve(response);
                })
                .catch((error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    }

    private generateSummary(rawResponse: string): string {
        // İleride daha akıllı bir özet çıkarıcı eklenebilir. Şimdilik ilk 100 karakter.
        if (rawResponse.length <= 100) return rawResponse;
        return rawResponse.substring(0, 100) + '...';
    }
}
