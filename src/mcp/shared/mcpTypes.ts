export interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties?: Record<string, any>;
        required?: string[];
    };
}

export interface MCPResource {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}

export interface MCPPromptArg {
    name: string;
    description?: string;
    required?: boolean;
}

export interface MCPPrompt {
    name: string;
    description?: string;
    arguments?: MCPPromptArg[];
}

export interface MCPSessionInfo {
    sessionId: string;
    serverUrl: string;
    status: 'connected' | 'disconnected';
}

export interface MCPRunHistory {
    eventId: string;
    eventName: string;
    timestamp: number;
    payload: any;
}

export interface MCPMetrics {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    discoveredToolsCount: number;
}
