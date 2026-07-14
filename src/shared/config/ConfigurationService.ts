import * as fs from 'fs';
import * as path from 'path';

export interface AIOSSettings {
    preferredAI: 'openai' | 'gemini' | 'mock';
    temperature: number;
    model: string;
    reviewLevel: 'low' | 'medium' | 'high';
    autoReview: boolean;
    autoAnalyze: boolean;
    maxContextSize: number;
    promptStyle: 'concise' | 'detailed' | 'verbose';
    workspaceScanDepth: number;
    [key: string]: any;
}

export class ConfigurationService {
    private readonly settingsFilePath: string;
    private cachedSettings: AIOSSettings;

    private readonly defaultSettings: AIOSSettings = {
        preferredAI: 'openai',
        temperature: 0.2,
        model: 'gpt-4o-mini',
        reviewLevel: 'medium',
        autoReview: false,
        autoAnalyze: false,
        maxContextSize: 4000,
        promptStyle: 'detailed',
        workspaceScanDepth: 3
    };

    constructor(workspaceRoot: string) {
        this.settingsFilePath = path.join(workspaceRoot, '.aios', 'settings.json');
        this.cachedSettings = { ...this.defaultSettings };
        this.loadSettings();
    }

    private loadSettings(): void {
        try {
            if (fs.existsSync(this.settingsFilePath)) {
                const content = fs.readFileSync(this.settingsFilePath, 'utf8');
                const parsed = JSON.parse(content);
                this.cachedSettings = { ...this.defaultSettings, ...parsed };
            }
        } catch (error) {
            console.error('Failed to load AIOS settings:', error);
            this.cachedSettings = { ...this.defaultSettings };
        }
    }

    public getSettings(): AIOSSettings {
        return { ...this.cachedSettings };
    }

    public updateSetting<K extends keyof AIOSSettings>(key: K, value: AIOSSettings[K]): void {
        this.cachedSettings[key] = value;
        this.saveSettings();
    }

    private saveSettings(): void {
        try {
            const dir = path.dirname(this.settingsFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.settingsFilePath, JSON.stringify(this.cachedSettings, null, 2), 'utf8');
        } catch (error) {
            console.error('Failed to save AIOS settings:', error);
        }
    }
}
