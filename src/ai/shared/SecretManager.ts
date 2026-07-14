export interface ISecretStorage {
    get(key: string): Promise<string | undefined>;
    store(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
}

export class SecretManager {
    private static instance: SecretManager;
    private storage?: ISecretStorage;

    private constructor() {}

    public static getInstance(): SecretManager {
        if (!SecretManager.instance) {
            SecretManager.instance = new SecretManager();
        }
        return SecretManager.instance;
    }

    public initialize(storage: ISecretStorage): void {
        this.storage = storage;
    }

    public async getApiKey(provider: string): Promise<string | undefined> {
        // Fallback to env variables (useful in tests or local CLI)
        const envKey = `${provider.toUpperCase()}_API_KEY`;
        if (process.env[envKey]) {
            return process.env[envKey];
        }

        if (!this.storage) {
            console.warn(`[SecretManager] No storage initialized. Cannot retrieve key for ${provider}`);
            return undefined;
        }

        const secretKey = `ai-task-orchestrator.${provider.toLowerCase()}-api-key`;
        return this.storage.get(secretKey);
    }

    public async storeApiKey(provider: string, key: string): Promise<void> {
        if (!this.storage) {
            throw new Error(`[SecretManager] Cannot store key. SecretStorage not initialized.`);
        }
        const secretKey = `ai-task-orchestrator.${provider.toLowerCase()}-api-key`;
        await this.storage.store(secretKey, key);
    }
}
