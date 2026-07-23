export class ConflictDetector {
    /**
     * Verilen dosya içeriğinde Git çakışma (conflict) işaretçilerinin olup olmadığını denetler.
     */
    public hasConflictMarkers(content: string): boolean {
        const lines = content.split('\n');
        let hasStart = false;
        let hasSeparator = false;
        let hasEnd = false;

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('<<<<<<<')) {
                hasStart = true;
            }
            if (trimmed.startsWith('=======')) {
                hasSeparator = true;
            }
            if (trimmed.startsWith('>>>>>>>')) {
                hasEnd = true;
            }
        }

        return hasStart && hasSeparator && hasEnd;
    }
}
