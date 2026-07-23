import { MCPTool, MCPResource, MCPPrompt } from '../shared/mcpTypes';

export class MCPRegistry {
    private static instance: MCPRegistry;
    private readonly tools = new Map<string, MCPTool>();
    private readonly resources = new Map<string, MCPResource>();
    private readonly prompts = new Map<string, MCPPrompt>();

    private constructor() {}

    public static getInstance(): MCPRegistry {
        if (!MCPRegistry.instance) {
            MCPRegistry.instance = new MCPRegistry();
        }
        return MCPRegistry.instance;
    }

    public registerTool(tool: MCPTool) {
        this.tools.set(tool.name, tool);
    }

    public registerResource(resource: MCPResource) {
        this.resources.set(resource.uri, resource);
    }

    public registerPrompt(prompt: MCPPrompt) {
        this.prompts.set(prompt.name, prompt);
    }

    public getTool(name: string): MCPTool | undefined {
        return this.tools.get(name);
    }

    public getResource(uri: string): MCPResource | undefined {
        return this.resources.get(uri);
    }

    public getPrompt(name: string): MCPPrompt | undefined {
        return this.prompts.get(name);
    }

    public getAllTools(): MCPTool[] {
        return Array.from(this.tools.values());
    }

    public getAllResources(): MCPResource[] {
        return Array.from(this.resources.values());
    }

    public getAllPrompts(): MCPPrompt[] {
        return Array.from(this.prompts.values());
    }

    public clear() {
        this.tools.clear();
        this.resources.clear();
        this.prompts.clear();
    }
}
