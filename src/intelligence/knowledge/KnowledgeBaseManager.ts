import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { AIOSArchitectureMap, AIOSHealthReport, AIOSKnowledge, AIOSRiskReport } from '../shared/intelligenceTypes';

export class KnowledgeBaseManager {
    private readonly aiosDir: string;

    constructor(workspaceRoot: string) {
        this.aiosDir = path.join(workspaceRoot, '.aios');
    }

    public async saveKnowledgeBase(knowledge: AIOSKnowledge): Promise<void> {
        await this.ensureAiosDir();
        const filePath = path.join(this.aiosDir, 'knowledge.json');
        await fs.writeFile(filePath, JSON.stringify(knowledge, null, 2), 'utf8');
    }

    public async saveArchitectureMap(archMap: AIOSArchitectureMap): Promise<void> {
        await this.ensureAiosDir();
        const filePath = path.join(this.aiosDir, 'architecture.json');
        await fs.writeFile(filePath, JSON.stringify(archMap, null, 2), 'utf8');
    }

    public async saveHealthReport(health: AIOSHealthReport): Promise<void> {
        await this.ensureAiosDir();
        const filePath = path.join(this.aiosDir, 'health.json');
        await fs.writeFile(filePath, JSON.stringify(health, null, 2), 'utf8');
    }

    public async saveRiskReport(risk: AIOSRiskReport): Promise<void> {
        await this.ensureAiosDir();
        const filePath = path.join(this.aiosDir, 'risk.json');
        await fs.writeFile(filePath, JSON.stringify(risk, null, 2), 'utf8');
    }

    private async ensureAiosDir(): Promise<void> {
        if (!existsSync(this.aiosDir)) {
            await fs.mkdir(this.aiosDir, { recursive: true });
        }
    }
}
