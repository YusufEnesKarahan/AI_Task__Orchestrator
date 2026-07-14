import * as fs from 'fs';
import * as path from 'path';

export interface PromptVersion {
    id: string;
    timestamp: number;
    promptText: string;
    description?: string;
}

export class PromptHistory {
    private historyPath: string;

    constructor(workspaceRoot: string) {
        this.historyPath = path.join(workspaceRoot, '.aios', 'prompt_history.json');
    }

    public recordVersion(promptText: string, description?: string): void {
        const history = this.loadHistory();
        
        const newVersion: PromptVersion = {
            id: `v_${Date.now()}`,
            timestamp: Date.now(),
            promptText,
            description
        };

        history.push(newVersion);
        this.saveHistory(history);
    }

    public getHistory(): PromptVersion[] {
        return this.loadHistory();
    }

    private loadHistory(): PromptVersion[] {
        if (!fs.existsSync(this.historyPath)) {
            return [];
        }
        try {
            const data = fs.readFileSync(this.historyPath, 'utf-8');
            return JSON.parse(data) as PromptVersion[];
        } catch (error) {
            console.error('[PromptHistory] Error loading history:', error);
            return [];
        }
    }

    private saveHistory(history: PromptVersion[]): void {
        const dir = path.dirname(this.historyPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2), 'utf-8');
    }
}
