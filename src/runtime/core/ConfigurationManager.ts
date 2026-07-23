import * as fs from 'fs';
import * as path from 'path';
import { AIOSConfig } from '../shared/runtimeTypes';
import { ConfigurationValidator } from '../../system/core/ConfigurationValidator';
import { EventBus } from '../../shared/events/EventBus';

const DEFAULT_CONFIG: AIOSConfig = {
    provider: 'mock',
    maxIterations: 5,
    workspaceRoot: process.cwd(),
    logLevel: 'info',
    enableTelemetry: true,
    enableCache: true
};

export class ConfigurationManager {
    private config: AIOSConfig = { ...DEFAULT_CONFIG };
    private readonly validator = new ConfigurationValidator();
    private readonly eventBus = EventBus.getInstance();
    private configPath: string;

    constructor(private readonly workspaceRoot: string) {
        this.configPath = path.join(workspaceRoot, 'aios.config.json');
        this.config.workspaceRoot = workspaceRoot;
    }

    /**
     * Varsayılan ayarları yükler; workspace'te aios.config.json varsa üzerine yazar (merge).
     */
    public load(): AIOSConfig {
        this.config = { ...DEFAULT_CONFIG, workspaceRoot: this.workspaceRoot };

        if (fs.existsSync(this.configPath)) {
            try {
                const raw = fs.readFileSync(this.configPath, 'utf-8');
                const fileConfig = JSON.parse(raw);
                this.config = { ...this.config, ...fileConfig, workspaceRoot: this.workspaceRoot };
            } catch {
                // Dosya okunamazsa varsayılan ayarlarla devam et
            }
        }

        this.eventBus.emit('ConfigurationLoaded', { configPath: this.configPath });
        return this.config;
    }

    /**
     * Güncel dosyadan tekrar okur.
     */
    public reload(): AIOSConfig {
        return this.load();
    }

    /**
     * Yapılandırmayı doğrular.
     */
    public validate(): boolean {
        return this.validator.validate(this.config);
    }

    public getConfig(): AIOSConfig {
        return { ...this.config };
    }

    public getConfigPath(): string {
        return this.configPath;
    }
}
