import { StartupCheck, StartupValidationResult } from '../shared/runtimeTypes';
import { EventBus } from '../../shared/events/EventBus';
import { ConfigurationManager } from './ConfigurationManager';
import { Logger } from './Logger';

/**
 * Başlangıç ön-uçuş kontrolleri.
 * Herhangi bir kontrol başarısız olursa Runtime başlatılmaz.
 */
export class StartupValidator {
    private readonly checks: StartupCheck[] = [];

    constructor(
        private readonly logger: Logger,
        private readonly configManager: ConfigurationManager
    ) {
        this.registerDefaultChecks();
    }

    private registerDefaultChecks(): void {
        // 1. Configuration doğrulama
        this.checks.push({
            name: 'Configuration',
            check: () => this.configManager.validate()
        });

        // 2. EventBus erişilebilirliği
        this.checks.push({
            name: 'EventBus',
            check: () => {
                try {
                    const bus = EventBus.getInstance();
                    return !!bus;
                } catch {
                    return false;
                }
            }
        });
    }

    /**
     * Harici kontrol kaydı.
     */
    public addCheck(name: string, check: () => boolean): void {
        this.checks.push({ name, check });
    }

    /**
     * Tüm kontrolleri çalıştırır ve sonucu döner.
     */
    public validate(): StartupValidationResult {
        const results: { name: string; ok: boolean }[] = [];

        for (const c of this.checks) {
            let ok = false;
            try {
                ok = c.check();
            } catch {
                ok = false;
            }
            results.push({ name: c.name, ok });
            this.logger.info(`  Startup check [${c.name}]: ${ok ? 'PASSED' : 'FAILED'}`);
        }

        const passed = results.every(r => r.ok);
        return { passed, results };
    }
}
