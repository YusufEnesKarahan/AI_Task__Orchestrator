import { HealthStatus } from '../shared/systemTypes';
import { AgentRegistry } from '../../agents/core/AgentRegistry';
import { WorkflowRegistry } from '../../workflow/core/WorkflowRegistry';
import { GitEngine } from '../../git/GitEngine';
import { MCPClient } from '../../mcp/MCPClient';

export class HealthMonitor {
    constructor(private readonly workspaceRoot: string) {}

    /**
     * Tüm AIOS modüllerinin ve bağlantılarının sağlık durumunu kontrol eder.
     */
    public checkHealth(): HealthStatus {
        const details: Record<string, boolean> = {
            agentRegistry: false,
            workflowRegistry: false,
            gitConnection: false,
            mcpConnection: false
        };

        // 1. AgentRegistry Kontrolü
        try {
            const agents = AgentRegistry.getInstance().getAllAgents();
            details.agentRegistry = agents.length > 0;
        } catch {
            details.agentRegistry = false;
        }

        // 2. WorkflowRegistry Kontrolü
        try {
            const templates = WorkflowRegistry.getInstance().getAllTemplates();
            details.workflowRegistry = templates.length > 0;
        } catch {
            details.workflowRegistry = false;
        }

        // 3. Git Bağlantısı Kontrolü
        try {
            const gitEngine = new GitEngine(this.workspaceRoot);
            details.gitConnection = !!gitEngine;
        } catch {
            details.gitConnection = false;
        }

        // 4. MCP Bağlantısı Kontrolü
        try {
            const mcpClient = new MCPClient(this.workspaceRoot);
            details.mcpConnection = !!mcpClient;
        } catch {
            details.mcpConnection = false;
        }

        const isHealthy = Object.values(details).every(v => v);

        return {
            status: isHealthy ? 'healthy' : 'unhealthy',
            details
        };
    }
}
