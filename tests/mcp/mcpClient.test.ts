import { describe, test, before, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import { MCPClient } from '../../src/mcp/MCPClient';
import { EventBus } from '../../src/shared/events/EventBus';

const TEMP_WORKSPACE = path.join(__dirname, '..', '..', 'scratch', 'temp_workspace_mcp_test');

describe('MCP & Tool Ecosystem Tests', () => {
    let client: MCPClient;

    before(() => {
        if (!fs.existsSync(TEMP_WORKSPACE)) {
            fs.mkdirSync(TEMP_WORKSPACE, { recursive: true });
        }
        client = new MCPClient(TEMP_WORKSPACE);
    });

    beforeEach(async () => {
        // Clear history & metrics
        const mcpDir = path.join(TEMP_WORKSPACE, '.aios', 'mcp');
        if (fs.existsSync(mcpDir)) {
            const files = fs.readdirSync(mcpDir);
            for (const file of files) {
                try {
                    fs.unlinkSync(path.join(mcpDir, file));
                } catch {
                    // Windows resource locks
                }
            }
        }
        
        // Ensure connected before each test (disconnect and reconnect)
        await client.disconnect();
        await client.connect('http://localhost:8080/mcp');
    });

    // ─── 1. Connection Lifecycle ─────────────────────────────────────────────
    test('should manage connection lifecycle and session information', async () => {
        const session = client.getSession();
        assert.ok(session);
        assert.strictEqual(session?.getStatus(), 'connected');
        assert.strictEqual(session?.getServerUrl(), 'http://localhost:8080/mcp');

        await client.disconnect();
        assert.strictEqual(client.getSession(), undefined);
    });

    // ─── 2. Tool Discovery ───────────────────────────────────────────────────
    test('should discover available tools on the server', async () => {
        const tools = await client.discoverTools();
        assert.ok(tools.length >= 6);
        
        const toolNames = tools.map(t => t.name);
        assert.ok(toolNames.includes('filesystem_read'));
        assert.ok(toolNames.includes('git_status'));
        assert.ok(toolNames.includes('db_query'));
    });

    // ─── 3. Tool Execution ───────────────────────────────────────────────────
    test('should execute tool calls and parse output correctly', async () => {
        const output = await client.executeTool('filesystem_read', { path: 'src/main.ts' });
        assert.ok(output.includes('filesystem_read'));
        assert.ok(output.includes('src/main.ts'));

        // Verify metrics
        const metrics = client.getMetrics();
        assert.strictEqual(metrics.totalCalls, 1);
        assert.strictEqual(metrics.successfulCalls, 1);
    });

    // ─── 4. Resource Loading ─────────────────────────────────────────────────
    test('should read remote resource contents successfully', async () => {
        const content = await client.readResource('mcp://workspace/src/db.ts');
        assert.ok(content.includes('mcp://workspace/src/db.ts'));
    });

    // ─── 5. Prompt Template Loading ──────────────────────────────────────────
    test('should retrieve and register prompt templates', async () => {
        const prompt = await client.loadPrompt('FeatureDevPrompt');
        assert.strictEqual(prompt.name, 'FeatureDevPrompt');
        assert.ok(prompt.arguments && prompt.arguments.length > 0);
        assert.strictEqual(prompt.arguments[0].name, 'task');
    });

    // ─── 6. EventBus Integration ─────────────────────────────────────────────
    test('should publish EventBus events for session and tool lifecycle', async () => {
        const eventBus = EventBus.getInstance();
        const events: string[] = [];

        const unsub = [
            eventBus.on('MCPToolDiscovered', () => events.push('Discovered')),
            eventBus.on('MCPToolExecuted', () => events.push('Executed')),
            eventBus.on('MCPResourceRead', () => events.push('Read')),
            eventBus.on('MCPPromptLoaded', () => events.push('Prompt'))
        ];

        await client.discoverTools();
        await client.executeTool('git_status', {});
        await client.readResource('mcp://readme');
        await client.loadPrompt('BugFixPrompt');

        unsub.forEach(fn => fn());

        assert.ok(events.includes('Discovered'));
        assert.ok(events.includes('Executed'));
        assert.ok(events.includes('Read'));
        assert.ok(events.includes('Prompt'));

        // Verify history persistence on disk
        const history = client.getHistory();
        assert.ok(history.length >= 4);
    });
});
