export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AIOSConfig {
    provider: string;
    maxIterations: number;
    workspaceRoot: string;
    logLevel: LogLevel;
    enableTelemetry: boolean;
    enableCache: boolean;
    [key: string]: any;
}

export type RuntimeStatus = 'idle' | 'starting' | 'ready' | 'stopping' | 'stopped' | 'error';

export type LifecyclePhase = 'initialize' | 'start' | 'ready' | 'stop' | 'dispose';

export interface LifecycleHook {
    name: string;
    phase: LifecyclePhase;
    handler: () => Promise<void>;
}

export interface BootstrapStep {
    name: string;
    handler: () => Promise<void>;
}

export interface StartupCheck {
    name: string;
    check: () => boolean;
}

export interface StartupValidationResult {
    passed: boolean;
    results: { name: string; ok: boolean }[];
}
