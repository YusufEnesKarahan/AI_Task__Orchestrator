export class MCPToolAdapter {
    /**
     * Araç (tool) çağrı girdilerini doğrular veya dönüştürür.
     */
    public adaptInput(toolName: string, args: Record<string, any>): any {
        // En azından args boş olmasın objesi garantilenir
        return args || {};
    }

    /**
     * MCP sunucusunun döndürdüğü ham sonucu standart string metne çevirir.
     */
    public adaptOutput(result: any): string {
        if (!result) return '';
        
        // Sunucu response'unda content dizisi varsa onu metinleştir
        if (Array.isArray(result.content)) {
            return result.content
                .map((item: any) => item.text || JSON.stringify(item))
                .join('\n');
        }

        return typeof result === 'object' ? JSON.stringify(result) : String(result);
    }
}
