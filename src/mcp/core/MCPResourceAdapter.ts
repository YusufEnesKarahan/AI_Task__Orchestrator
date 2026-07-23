export class MCPResourceAdapter {
    /**
     * MCP sunucusundan gelen ham kaynak (resource) içeriğini normalize eder.
     */
    public adaptResourceContent(result: any): string {
        if (!result) return '';

        if (Array.isArray(result.contents)) {
            return result.contents
                .map((content: any) => content.text || JSON.stringify(content))
                .join('\n');
        }

        return typeof result === 'object' ? JSON.stringify(result) : String(result);
    }
}
