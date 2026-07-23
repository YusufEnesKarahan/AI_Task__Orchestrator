export interface ActiveEditorInfo {
    filePath: string;
    content: string;
    languageId: string;
}

export interface SelectionInfo {
    text: string;
    startLine: number;
    endLine: number;
}

export interface DiagnosticInfo {
    filePath: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
    line: number;
}

export interface WorkspaceInfo {
    workspaceRoot: string;
    folders: string[];
}

export interface BridgeRunLog {
    eventId: string;
    eventName: string;
    timestamp: number;
    payload: any;
}

export interface BridgeMetrics {
    totalEvents: number;
    activeEditorsOpened: number;
    commandsExecuted: number;
}
