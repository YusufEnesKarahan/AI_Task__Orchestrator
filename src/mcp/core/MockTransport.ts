import { ITransport } from './ITransport';

export class MockTransport implements ITransport {
    private connected = false;

    public async connect(serverUrl: string): Promise<boolean> {
        this.connected = true;
        return true;
    }

    public async disconnect(): Promise<void> {
        this.connected = false;
    }

    public async send(message: any): Promise<any> {
        if (!this.connected) {
            throw new Error('Transport bağlantısı kapalı.');
        }

        const id = message.id;
        const method = message.method;

        if (method === 'tools/list') {
            return {
                id,
                result: {
                    tools: [
                        {
                            name: 'filesystem_read',
                            description: 'Reads file from workspace filesystem',
                            inputSchema: {
                                type: 'object',
                                properties: { path: { type: 'string' } },
                                required: ['path']
                            }
                        },
                        {
                            name: 'git_status',
                            description: 'Gets current git branch and changes',
                            inputSchema: { type: 'object' }
                        },
                        {
                            name: 'terminal_exec',
                            description: 'Runs terminal shell command',
                            inputSchema: {
                                type: 'object',
                                properties: { command: { type: 'string' } },
                                required: ['command']
                            }
                        },
                        {
                            name: 'http_request',
                            description: 'Makes web HTTP API call',
                            inputSchema: {
                                type: 'object',
                                properties: { url: { type: 'string' } },
                                required: ['url']
                            }
                        },
                        {
                            name: 'memory_store',
                            description: 'Stores semantic data in model registry',
                            inputSchema: {
                                type: 'object',
                                properties: { key: { type: 'string' }, value: { type: 'string' } },
                                required: ['key', 'value']
                            }
                        },
                        {
                            name: 'db_query',
                            description: 'Executes SQL database select or update query',
                            inputSchema: {
                                type: 'object',
                                properties: { sql: { type: 'string' } },
                                required: ['sql']
                            }
                        }
                    ]
                }
            };
        }

        if (method === 'tools/call') {
            const toolName = message.params?.name;
            const args = message.params?.arguments || {};

            return {
                id,
                result: {
                    content: [
                        {
                            type: 'text',
                            text: `Mock executed ${toolName} with args: ${JSON.stringify(args)}`
                        }
                    ]
                }
            };
        }

        if (method === 'resources/read') {
            const uri = message.params?.uri;
            return {
                id,
                result: {
                    contents: [
                        {
                            uri,
                            text: `Mock resource data for URI: ${uri}`
                        }
                    ]
                }
            };
        }

        if (method === 'prompts/get') {
            const promptName = message.params?.name;
            return {
                id,
                result: {
                    prompt: {
                        name: promptName,
                        description: `Mock prompt template: ${promptName}`,
                        arguments: [{ name: 'task', description: 'Task content', required: true }]
                    }
                }
            };
        }

        return { id, error: { code: -32601, message: `Method not found: ${method}` } };
    }
}
