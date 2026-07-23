import { EventBus } from '../../shared/events/EventBus';
import { Logger } from './Logger';
import { ConfigurationManager } from './ConfigurationManager';
import { DependencyContainer } from './DependencyContainer';
import { BootstrapStep } from '../shared/runtimeTypes';

/**
 * Başlangıç sırasını yöneten Bootstrap orkestratörü.
 *
 * Configuration → Container → EventBus → Registry → Memory →
 * Git → MCP → Workflow → System → Ready
 */
export class Bootstrapper {
    private readonly steps: BootstrapStep[] = [];
    private completedSteps = 0;

    constructor(
        private readonly logger: Logger,
        private readonly configManager: ConfigurationManager,
        private readonly container: DependencyContainer,
        private readonly eventBus: EventBus
    ) {
        this.buildDefaultSteps();
    }

    private buildDefaultSteps(): void {
        this.steps.push({
            name: 'Loading configuration',
            handler: async () => {
                this.configManager.load();
            }
        });

        this.steps.push({
            name: 'Initializing Container',
            handler: async () => {
                // Engine factory kayıtları burada yapılır
                const wsRoot = this.configManager.getConfig().workspaceRoot;

                this.container.singleton('WorkflowEngine', () => {
                    const { WorkflowEngine } = require('../../workflow/WorkflowEngine');
                    return new WorkflowEngine(wsRoot);
                });

                this.container.singleton('GitEngine', () => {
                    const { GitEngine } = require('../../git/GitEngine');
                    return new GitEngine(wsRoot);
                });

                this.container.singleton('MCPClient', () => {
                    const { MCPClient } = require('../../mcp/MCPClient');
                    return new MCPClient(wsRoot);
                });

                this.container.singleton('SystemEngine', () => {
                    const { SystemEngine } = require('../../system/SystemEngine');
                    return new SystemEngine(wsRoot);
                });

                this.container.singleton('ReviewEngine', () => {
                    const { ReviewEngine } = require('../../review/ReviewEngine');
                    return new ReviewEngine(wsRoot);
                });

                this.container.singleton('ActionEngine', () => {
                    const { ActionEngine } = require('../../actions/ActionEngine');
                    return new ActionEngine(wsRoot);
                });

                this.eventBus.emit('ContainerReady', { registeredCount: this.container.registeredCount });
            }
        });

        this.steps.push({
            name: 'Initializing EventBus',
            handler: async () => {
                // EventBus zaten singleton, burada sadece hazır olduğunu doğruluyoruz
                EventBus.getInstance();
            }
        });

        this.steps.push({
            name: 'Loading Engines',
            handler: async () => {
                // Engine'leri lazy resolve ile hazır hale getirmiyoruz —
                // ilk kullanımda çözümlenecekler (lazy loading).
                // Sadece Container'ın kayıtlarının tamamlandığını doğruluyoruz.
                this.logger.info(`  Container has ${this.container.registeredCount} registered services.`);
            }
        });
    }

    /**
     * Harici adım kaydı.
     */
    public addStep(name: string, handler: () => Promise<void>): void {
        this.steps.push({ name, handler });
    }

    /**
     * Tüm bootstrap adımlarını sırasıyla çalıştırır.
     */
    public async run(): Promise<number> {
        const start = Date.now();
        this.completedSteps = 0;

        for (const step of this.steps) {
            this.logger.info(step.name + '...');
            await step.handler();
            this.completedSteps++;
        }

        const durationMs = Date.now() - start;
        this.eventBus.emit('BootstrapCompleted', {
            stepsCompleted: this.completedSteps,
            durationMs
        });

        return durationMs;
    }

    public getStepCount(): number {
        return this.steps.length;
    }

    public getCompletedSteps(): number {
        return this.completedSteps;
    }
}
