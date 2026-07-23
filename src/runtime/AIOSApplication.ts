import { EventBus } from '../shared/events/EventBus';
import { RuntimeStatus } from './shared/runtimeTypes';
import { Logger } from './core/Logger';
import { ConfigurationManager } from './core/ConfigurationManager';
import { DependencyContainer } from './core/DependencyContainer';
import { RuntimeContext } from './core/RuntimeContext';
import { LifecycleManager } from './core/LifecycleManager';
import { StartupValidator } from './core/StartupValidator';
import { Bootstrapper } from './core/Bootstrapper';

/**
 * AIOS sisteminin ana giriş noktası.
 *
 * ```ts
 * const app = AIOSApplication.create();
 * await app.start();
 * await app.stop();
 * ```
 */
export class AIOSApplication {
    private runtimeStatus: RuntimeStatus = 'idle';
    private readonly eventBus: EventBus;
    private readonly logger: Logger;
    private readonly configManager: ConfigurationManager;
    private readonly container: DependencyContainer;
    private readonly lifecycleManager: LifecycleManager;
    private readonly startupValidator: StartupValidator;
    private readonly bootstrapper: Bootstrapper;
    private context: RuntimeContext | undefined;

    private constructor(private readonly workspaceRoot: string) {
        this.eventBus = EventBus.getInstance();
        this.logger = new Logger(workspaceRoot, 'info');
        this.configManager = new ConfigurationManager(workspaceRoot);
        this.container = new DependencyContainer();
        this.lifecycleManager = new LifecycleManager(this.logger);
        this.startupValidator = new StartupValidator(this.logger, this.configManager);
        this.bootstrapper = new Bootstrapper(this.logger, this.configManager, this.container, this.eventBus);
    }

    /**
     * Statik factory metodu.
     */
    public static create(workspaceRoot?: string): AIOSApplication {
        const root = workspaceRoot || process.cwd();
        return new AIOSApplication(root);
    }

    /**
     * AIOS Runtime'ı başlatır.
     */
    public async start(): Promise<boolean> {
        if (this.runtimeStatus === 'ready') {
            this.logger.warn('AIOS zaten çalışıyor.');
            return true;
        }

        this.runtimeStatus = 'starting';
        this.eventBus.emit('RuntimeStarting', { timestamp: Date.now() });
        this.logger.info('Starting AIOS...');

        // 1. Yapılandırma yükle (bootstrap öncesi doğrulama için gerekli)
        this.configManager.load();

        // 2. Ön-uçuş kontrolleri
        this.logger.info('Running startup validations...');
        const validation = this.startupValidator.validate();
        if (!validation.passed) {
            this.runtimeStatus = 'error';
            this.logger.error('Startup validation FAILED. AIOS cannot start.');
            return false;
        }

        // 3. Bootstrap sırası
        const bootstrapDuration = await this.bootstrapper.run();

        // 4. Lifecycle başlatma
        await this.lifecycleManager.startup();

        // 5. RuntimeContext oluşturma
        this.context = new RuntimeContext(
            this.workspaceRoot,
            this.container,
            this.configManager,
            this.logger
        );

        this.runtimeStatus = 'ready';
        this.eventBus.emit('RuntimeReady', {
            timestamp: Date.now(),
            bootstrapDurationMs: bootstrapDuration
        });
        this.logger.info('AIOS Started Successfully.');

        return true;
    }

    /**
     * AIOS Runtime'ı durdurur.
     */
    public async stop(): Promise<void> {
        if (this.runtimeStatus !== 'ready') {
            this.logger.warn('AIOS çalışmıyor, durdurulamaz.');
            return;
        }

        this.runtimeStatus = 'stopping';
        this.eventBus.emit('RuntimeStopping', { timestamp: Date.now() });
        this.logger.info('Stopping AIOS...');

        await this.lifecycleManager.shutdown();

        this.runtimeStatus = 'stopped';
        this.eventBus.emit('RuntimeStopped', { timestamp: Date.now() });
        this.logger.info('AIOS Stopped.');
    }

    /**
     * AIOS Runtime'ı yeniden başlatır.
     */
    public async restart(): Promise<boolean> {
        this.logger.info('Restarting AIOS...');
        await this.stop();
        return this.start();
    }

    /**
     * Güncel Runtime durumunu döner.
     */
    public status(): RuntimeStatus {
        return this.runtimeStatus;
    }

    /**
     * RuntimeContext erişimi.
     */
    public getContext(): RuntimeContext | undefined {
        return this.context;
    }

    /**
     * DI Container erişimi.
     */
    public getContainer(): DependencyContainer {
        return this.container;
    }

    /**
     * Logger erişimi.
     */
    public getLogger(): Logger {
        return this.logger;
    }
}
