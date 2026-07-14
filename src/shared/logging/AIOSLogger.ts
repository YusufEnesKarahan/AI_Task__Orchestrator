import { EventBus } from '../events/EventBus';

export type AIOSLogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

export interface AIOSLog {
    id: string;
    timestamp: number;
    source: string;
    module: string;
    severity: AIOSLogLevel;
    message: string;
}

export class AIOSLogger {
    public static log(severity: AIOSLogLevel, module: string, source: string, message: string): AIOSLog {
        const logRecord: AIOSLog = {
            id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            timestamp: Date.now(),
            source,
            module,
            severity,
            message
        };

        console.log(`[${severity.toUpperCase()}][${module}][${source}] ${message}`);

        // Emit via central EventBus
        EventBus.getInstance().emit('LogAdded', { log: logRecord });

        return logRecord;
    }

    public static info(module: string, source: string, message: string): AIOSLog {
        return this.log('info', module, source, message);
    }

    public static warn(module: string, source: string, message: string): AIOSLog {
        return this.log('warn', module, source, message);
    }

    public static error(module: string, source: string, message: string): AIOSLog {
        return this.log('error', module, source, message);
    }

    public static debug(module: string, source: string, message: string): AIOSLog {
        return this.log('debug', module, source, message);
    }

    public static success(module: string, source: string, message: string): AIOSLog {
        return this.log('success', module, source, message);
    }
}
