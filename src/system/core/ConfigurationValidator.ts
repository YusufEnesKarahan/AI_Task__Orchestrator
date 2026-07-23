export class ConfigurationValidator {
    /**
     * AIOS sistem ve sağlayıcı yapılandırmalarını doğrular.
     */
    public validate(config: any): boolean {
        if (!config || typeof config !== 'object') {
            return false;
        }

        // Sağlayıcı (Provider) kontrolü
        if (config.provider && !['openai', 'gemini', 'mock'].includes(config.provider)) {
            return false;
        }

        // Yineleme limiti kontrolü
        if (config.maxIterations !== undefined && (typeof config.maxIterations !== 'number' || config.maxIterations <= 0)) {
            return false;
        }

        return true;
    }
}
