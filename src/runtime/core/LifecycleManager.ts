import { LifecyclePhase, LifecycleHook } from '../shared/runtimeTypes';
import { Logger } from './Logger';

/**
 * Tüm modüllerin yaşam döngüsünü sıralı olarak yönetir.
 * initialize → start → ready → stop → dispose
 */
export class LifecycleManager {
    private readonly hooks: LifecycleHook[] = [];
    private readonly completedPhases: LifecyclePhase[] = [];

    constructor(private readonly logger: Logger) {}

    /**
     * Belirtilen aşamaya bir yaşam döngüsü kancası ekler.
     */
    public addHook(name: string, phase: LifecyclePhase, handler: () => Promise<void>): void {
        this.hooks.push({ name, phase, handler });
    }

    /**
     * Belirtilen aşamadaki tüm kancaları sırasıyla çalıştırır.
     */
    public async runPhase(phase: LifecyclePhase): Promise<void> {
        const phaseHooks = this.hooks.filter(h => h.phase === phase);
        this.logger.info(`Lifecycle phase: ${phase} (${phaseHooks.length} hooks)`);

        for (const hook of phaseHooks) {
            this.logger.debug(`  Running hook: ${hook.name}`);
            await hook.handler();
        }

        this.completedPhases.push(phase);
    }

    /**
     * Tüm yaşam döngüsü aşamalarını sırasıyla çalıştırır (başlatma).
     */
    public async startup(): Promise<void> {
        await this.runPhase('initialize');
        await this.runPhase('start');
        await this.runPhase('ready');
    }

    /**
     * Kapatma aşamalarını sırasıyla çalıştırır.
     */
    public async shutdown(): Promise<void> {
        await this.runPhase('stop');
        await this.runPhase('dispose');
    }

    public getCompletedPhases(): LifecyclePhase[] {
        return [...this.completedPhases];
    }

    public getHookCount(): number {
        return this.hooks.length;
    }
}
