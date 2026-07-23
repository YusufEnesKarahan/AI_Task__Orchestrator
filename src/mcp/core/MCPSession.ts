import { ITransport } from './ITransport';

export class MCPSession {
    private readonly sessionId: string;
    private status: 'connected' | 'disconnected' = 'disconnected';
    private nextRequestId = 1;

    constructor(
        private readonly serverUrl: string,
        private readonly transport: ITransport
    ) {
        this.sessionId = `sess_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }

    public getSessionId(): string {
        return this.sessionId;
    }

    public getServerUrl(): string {
        return this.serverUrl;
    }

    public getStatus(): 'connected' | 'disconnected' {
        return this.status;
    }

    public async connect(): Promise<boolean> {
        const success = await this.transport.connect(this.serverUrl);
        if (success) {
            this.status = 'connected';
        }
        return success;
    }

    public async disconnect(): Promise<void> {
        await this.transport.disconnect();
        this.status = 'disconnected';
    }

    /**
     * JSON-RPC 2.0 standardında istek gönderir.
     */
    public async sendRequest(method: string, params?: any): Promise<any> {
        if (this.status !== 'connected') {
            throw new Error('MCP oturumu kapalı. İstek gönderilemiyor.');
        }

        const id = this.nextRequestId++;
        const request = {
            jsonrpc: '2.0',
            id,
            method,
            params
        };

        const response = await this.transport.send(request);
        if (response.error) {
            throw new Error(`MCP JSON-RPC hatası: ${response.error.message} (kod: ${response.error.code})`);
        }
        return response.result;
    }
}
