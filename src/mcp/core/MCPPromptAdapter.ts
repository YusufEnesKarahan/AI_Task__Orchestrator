import { MCPPrompt } from '../shared/mcpTypes';

export class MCPPromptAdapter {
    /**
     * MCP sunucusundan gelen ham prompt şablonunu normalize eder.
     */
    public adaptPromptTemplate(result: any): MCPPrompt {
        if (!result) {
            throw new Error('Geçersiz prompt şablonu verisi.');
        }

        const prompt = result.prompt || result;

        return {
            name: prompt.name || 'Untitled Prompt',
            description: prompt.description || '',
            arguments: Array.isArray(prompt.arguments) ? prompt.arguments : []
        };
    }
}
