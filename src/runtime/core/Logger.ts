import * as fs from 'fs';
import * as path from 'path';
import { LogLevel } from '../shared/runtimeTypes';

export class Logger {
    private logDir: string | undefined;
    private logFilePath: string | undefined;
    private level: LogLevel = 'info';

    private static readonly LEVEL_ORDER: Record<LogLevel, number> = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
    };

    constructor(workspaceRoot?: string, level?: LogLevel) {
        if (level) this.level = level;
        if (workspaceRoot) {
            this.logDir = path.join(workspaceRoot, '.aios', 'logs');
            if (!fs.existsSync(this.logDir)) {
                fs.mkdirSync(this.logDir, { recursive: true });
            }
            const dateStr = new Date().toISOString().slice(0, 10);
            this.logFilePath = path.join(this.logDir, `aios-${dateStr}.log`);
        }
    }

    public setLevel(level: LogLevel): void {
        this.level = level;
    }

    public debug(message: string, ...args: any[]): void {
        this.log('debug', message, ...args);
    }

    public info(message: string, ...args: any[]): void {
        this.log('info', message, ...args);
    }

    public warn(message: string, ...args: any[]): void {
        this.log('warn', message, ...args);
    }

    public error(message: string, ...args: any[]): void {
        this.log('error', message, ...args);
    }

    private log(level: LogLevel, message: string, ...args: any[]): void {
        if (Logger.LEVEL_ORDER[level] < Logger.LEVEL_ORDER[this.level]) return;

        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        const formatted = args.length > 0
            ? `${prefix} ${message} ${args.map(a => JSON.stringify(a)).join(' ')}`
            : `${prefix} ${message}`;

        // Console output
        const consoleMethod = level === 'error' ? console.error
            : level === 'warn' ? console.warn
            : console.log;
        consoleMethod(formatted);

        // File output
        if (this.logFilePath) {
            try {
                fs.appendFileSync(this.logFilePath, formatted + '\n', 'utf-8');
            } catch {
                // Silently ignore file write errors
            }
        }
    }
}
