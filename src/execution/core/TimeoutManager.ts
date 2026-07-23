import { TimeoutConfig } from '../shared/executionTypes';

export class TimeoutManager {
    constructor(private readonly config: TimeoutConfig = { timeoutMs: 5000 }) {}

    /**
     * Verilen işlemi çalıştırır, süre aşılırsa hata fırlatır.
     */
    public async execute<T>(operation: () => Promise<T>): Promise<T> {
        let timeoutHandle: NodeJS.Timeout;
        
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => {
                reject(new Error(`İşlem ${this.config.timeoutMs}ms içinde tamamlanamadı ve zaman aşımına uğradı.`));
            }, this.config.timeoutMs);
        });

        try {
            return await Promise.race([operation(), timeoutPromise]);
        } finally {
            clearTimeout(timeoutHandle!);
        }
    }
}
