import * as fs from 'fs';
import * as path from 'path';
import { EventBus } from '../shared/events/EventBus';
import { MCPSession } from './core/MCPSession';
import { MCPRegistry } from './core/MCPRegistry';
import { MockTransport } from './core/MockTransport';
import { MCPToolAdapter } from './core/MCPToolAdapter';
import { MCPResourceAdapter } from './core/MCPResourceAdapter';
import { MCPPromptAdapter } from './core/MCPPromptAdapter';
import { MCPTool, MCPResource, MCPPrompt, MCPSessionInfo, MCPRunHistory, MCPMetrics } from './shared/mcpTypes';

export class MCPClient {
    private session: MCPSession | undefined;
    private readonly registry = MCPRegistry.getInstance();
    private readonly toolAdapter = new MCPToolAdapter();
    private readonly resourceAdapter = new MCPResourceAdapter();
    private readonly promptAdapter = new MCPPromptAdapter();
    private readonly eventBus = EventBus.getInstance();

    private readonly mcpDir: string;
    private readonly historyPath: string;
    private readonly metricsPath: string;

    constructor(private readonly workspaceRoot: string) {
        this.mcpDir = path.join(workspaceRoot, '.aios', 'mcp');
        this.historyPath = path.join(this.mcpDir, 'history.json');
        this.metricsPath = path.join(this.mcpDir, 'metrics.json');
        
        this.ensureDirExists();
    }

    private ensureDirExists() {
        if (!fs.existsSync(this.mcpDir)) {
            fs.mkdirSync(this.mcpDir, { recursive: true });
        }
    }

    /**
     * MCP Sunucusuna bağlantı sağlar.
     */
    public async connect(serverUrl: string): Promise<boolean> {
        // Testler ve basit simülasyonlar için MockTransport kullanılır
        const transport = new MockTransport();
        this.session = new MCPSession(serverUrl, transport);

        this.eventBus.emit('MCPSessionStarted', { sessionId: this.session.getSessionId() });
        
        const success = await this.session.connect();
        if (success) {
            this.eventBus.emit('MCPConnected', { serverUrl });
            this.logAndEmit('MCPConnected', { serverUrl });
        }
        return success;
    }

    /**
     * Bağlantıyı sonlandırır.
     */
    public async disconnect(): Promise<void> {
        if (this.session) {
            const serverUrl = this.session.getServerUrl();
            const sessionId = this.session.getSessionId();
            
            await this.session.disconnect();
            this.eventBus.emit('MCPDisconnected', { serverUrl });
            this.eventBus.emit('MCPSessionClosed', { sessionId });
            this.logAndEmit('MCPDisconnected', { serverUrl });
        }
        this.session = undefined;
    }

    /**
     * Sunucudan kullanılabilir araçların listesini çeker ve kaydeder.
     */
    public async discoverTools(): Promise<MCPTool[]> {
        if (!this.session) {
            throw new Error('Bağlantı açık değil. Araç keşfi yapılamıyor.');
        }

        const result = await this.session.sendRequest('tools/list');
        const tools: MCPTool[] = result.tools || [];
        
        tools.forEach(t => {
            this.registry.registerTool(t);
            this.eventBus.emit('MCPToolDiscovered', { serverUrl: this.session!.getServerUrl(), toolName: t.name });
        });

        this.updateMetrics('discoveredToolsCount', tools.length, true);
        return tools;
    }

    /**
     * Belirtilen aracı girdileriyle çalıştırır.
     */
    public async executeTool(toolName: string, args: Record<string, any>): Promise<string> {
        if (!this.session) {
            throw new Error('Bağlantı açık değil. Araç çalıştırılamıyor.');
        }

        const input = this.toolAdapter.adaptInput(toolName, args);
        let output = '';
        let success = false;

        try {
            const res = await this.session.sendRequest('tools/call', { name: toolName, arguments: input });
            output = this.toolAdapter.adaptOutput(res);
            success = true;
            this.updateMetrics('successfulCalls', 1);
        } catch (error: any) {
            output = error.message;
            success = false;
            this.updateMetrics('failedCalls', 1);
            throw error;
        } finally {
            this.eventBus.emit('MCPToolExecuted', { toolName, success });
            this.logAndEmit('MCPToolExecuted', { toolName, success });
            this.updateMetrics('totalCalls', 1);
        }

        return output;
    }

    /**
     * Belirtilen URI üzerinden harici kaynağı okur.
     */
    public async readResource(uri: string): Promise<string> {
        if (!this.session) {
            throw new Error('Bağlantı açık değil. Kaynak okunamıyor.');
        }

        let success = false;
        try {
            const res = await this.session.sendRequest('resources/read', { uri });
            const content = this.resourceAdapter.adaptResourceContent(res);
            success = true;
            return content;
        } catch (error) {
            success = false;
            throw error;
        } finally {
            this.eventBus.emit('MCPResourceRead', { uri, success });
            this.logAndEmit('MCPResourceRead', { uri, success });
        }
    }

    /**
     * Sunucudan belirtilen prompt şablonunu çeker.
     */
    public async loadPrompt(promptName: string): Promise<MCPPrompt> {
        if (!this.session) {
            throw new Error('Bağlantı açık değil. Prompt yüklenemiyor.');
        }

        const res = await this.session.sendRequest('prompts/get', { name: promptName });
        const adapted = this.promptAdapter.adaptPromptTemplate(res);
        this.registry.registerPrompt(adapted);
        
        this.eventBus.emit('MCPPromptLoaded', { promptName });
        this.logAndEmit('MCPPromptLoaded', { promptName });
        return adapted;
    }

    /**
     * Güncel oturum bilgisini döner.
     */
    public getSession(): MCPSession | undefined {
        return this.session;
    }

    public getHistory(): MCPRunHistory[] {
        if (!fs.existsSync(this.historyPath)) return [];
        try {
            const data = fs.readFileSync(this.historyPath, 'utf-8');
            return JSON.parse(data) as MCPRunHistory[];
        } catch {
            return [];
        }
    }

    public getMetrics(): MCPMetrics {
        if (!fs.existsSync(this.metricsPath)) {
            return {
                totalCalls: 0,
                successfulCalls: 0,
                failedCalls: 0,
                discoveredToolsCount: 0
            };
        }
        try {
            const data = fs.readFileSync(this.metricsPath, 'utf-8');
            return JSON.parse(data) as MCPMetrics;
        } catch {
            return {
                totalCalls: 0,
                successfulCalls: 0,
                failedCalls: 0,
                discoveredToolsCount: 0
            };
        }
    }

    private logAndEmit(eventName: string, payload: any) {
        const log: MCPRunHistory = {
            eventId: `mcp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            eventName,
            timestamp: Date.now(),
            payload
        };

        let history = this.getHistory();
        history.push(log);
        if (history.length > 100) {
            history.shift();
        }
        fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2), 'utf-8');
    }

    private updateMetrics(field: keyof MCPMetrics, value: number, set = false) {
        const metrics = this.getMetrics();
        if (set) {
            metrics[field] = value;
        } else {
            metrics[field] += value;
        }
        fs.writeFileSync(this.metricsPath, JSON.stringify(metrics, null, 2), 'utf-8');
    }
}
