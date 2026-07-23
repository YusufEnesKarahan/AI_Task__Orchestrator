import { EventBus } from '../../shared/events/EventBus';
import { Logger } from './Logger';
import { ConfigurationManager } from './ConfigurationManager';
import { DependencyContainer } from './DependencyContainer';
import { AIOSConfig } from '../shared/runtimeTypes';

/**
 * Tüm Engine'lerin ortak erişim noktası.
 * EventBus, Logger, Configuration ve DI Container'a merkezi erişim sağlar.
 */
export class RuntimeContext {
    public readonly eventBus: EventBus;
    public readonly logger: Logger;
    public readonly configManager: ConfigurationManager;
    public readonly container: DependencyContainer;

    constructor(
        workspaceRoot: string,
        container: DependencyContainer,
        configManager: ConfigurationManager,
        logger: Logger
    ) {
        this.eventBus = EventBus.getInstance();
        this.logger = logger;
        this.configManager = configManager;
        this.container = container;
    }

    public getConfig(): AIOSConfig {
        return this.configManager.getConfig();
    }
}
