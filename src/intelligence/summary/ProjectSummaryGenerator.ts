import * as fs from 'fs/promises';
import * as path from 'path';
import { AIOSArchitectureMap, AIOSHealthReport, AIOSKnowledge, AIOSRiskReport } from '../shared/intelligenceTypes';

export class ProjectSummaryGenerator {
    private readonly aiosDir: string;

    constructor(workspaceRoot: string) {
        this.aiosDir = path.join(workspaceRoot, '.aios');
    }

    public async generateAndSave(
        knowledge: AIOSKnowledge,
        archMap: AIOSArchitectureMap,
        health: AIOSHealthReport,
        risk: AIOSRiskReport
    ): Promise<string> {
        await fs.mkdir(this.aiosDir, { recursive: true });

        const lines: string[] = [
            `# Project Summary — ${knowledge.projectName}`,
            '',
            `*Tarama Tarihi: ${new Date(knowledge.generatedTime).toLocaleString()}*`,
            '',
            '## 1. Proje Özeti',
            `Bu proje, **${knowledge.projectType}** yapısında kurulmuş bir yazılımdır. Toplamda yaklaşık ${knowledge.folderStructure.length} kök bileşene ve modüle sahiptir.`,
            `Workspace hash: \`${knowledge.workspaceHash.slice(0, 12)}\``,
            '',
            '## 2. Teknolojiler',
            'Taramada tespit edilen teknoloji yığını (Confidence skoru ile):',
            ''
        ];

        if (knowledge.technologies.length === 0) {
            lines.push('- Belirgin bir teknoloji tespit edilemedi.');
        } else {
            for (const tech of knowledge.technologies) {
                lines.push(`- **${tech.name}** (${tech.type}) — Confidence: %${Math.round(tech.confidence * 100)}`);
            }
        }

        lines.push(
            '',
            '## 3. Mimari Yapı',
            `*   **Mevcut Mimari Stil:** ${knowledge.architecture.type} (Güven Skoru: %${Math.round(knowledge.architecture.confidence * 100)})`,
            `*   **Katman Sayısı:** ${archMap.layers.length}`,
            ''
        );

        if (archMap.layers.length > 0) {
            lines.push('Tanımlanan mimari katmanlar:');
            for (const layer of archMap.layers) {
                lines.push(`- **${layer.name}** (\`${layer.pathPattern}\`)`);
            }
        }

        lines.push(
            '',
            '## 4. Modüller ve Servis Bağlantıları',
            `*   **Toplam Modül Sayısı:** ${knowledge.modules.length}`,
            `*   **Toplam Bağımlılık Bağlantısı:** ${knowledge.dependencies.length}`,
            ''
        );

        lines.push(
            '## 5. Sağlık ve Kalite Raporu',
            `*   **Architecture Score:** ${health.architectureScore}/100`,
            `*   **Maintainability (Bakım Yapılabilirlik):** ${health.maintainability}/100`,
            `*   **Complexity (Karmaşıklık):** ${health.complexity}/100`,
            `*   **Documentation:** ${health.documentation}/100`,
            `*   **Testing:** ${health.testing}/100`,
            `*   **Technical Debt (Teknik Borç Oranı):** %${health.technicalDebt}`,
            ''
        );

        lines.push('## 6. Riskler ve Eksikler');
        if (risk.largeFiles.length > 0) {
            lines.push('### Dev Dosya / Component Riskleri');
            for (const file of risk.largeFiles.slice(0, 5)) {
                lines.push(`- Dev Dosya: \`${file}\``);
            }
        }

        if (risk.largeComponents.length > 0) {
            lines.push('### Büyük UI Component Riskleri');
            for (const file of risk.largeComponents.slice(0, 5)) {
                lines.push(`- Büyük component: \`${file}\``);
            }
        }

        if (risk.duplicateCode.length > 0) {
            lines.push('### Duplicate Code Riskleri');
            for (const duplicate of risk.duplicateCode.slice(0, 5)) {
                lines.push(`- Benzer dosyalar: \`${duplicate}\``);
            }
        }

        if (risk.unusedFiles.length > 0) {
            lines.push('### Artık / Geçici Dosya Riskleri');
            for (const file of risk.unusedFiles.slice(0, 5)) {
                lines.push(`- Artık dosya: \`${file}\``);
            }
        }

        if (risk.circularDependencies.length > 0) {
            lines.push('### Circular Dependency Riskleri');
            for (const cycle of risk.circularDependencies.slice(0, 5)) {
                lines.push(`- Döngü: \`${cycle.join(' -> ')}\``);
            }
        }

        if (risk.architectureViolations.length > 0) {
            lines.push('### Mimari Katman İhlalleri');
            for (const violation of risk.architectureViolations.slice(0, 5)) {
                lines.push(`- ${violation}`);
            }
        }

        if (
            risk.largeFiles.length === 0 &&
            risk.largeComponents.length === 0 &&
            risk.duplicateCode.length === 0 &&
            risk.unusedFiles.length === 0 &&
            risk.circularDependencies.length === 0 &&
            risk.architectureViolations.length === 0
        ) {
            lines.push('Tarama sırasında kritik bir kod veya mimari riskine rastlanmadı.');
        }

        lines.push(
            '',
            '## 7. Güçlü Yönler',
            '- **Modüler Dizin Yapısı:** Projedeki sorumluluklar belirli klasör rollerine ayrılmıştır.',
            '- **Tip Güvenliği:** TypeScript desteği ile statik tip güvenliği sağlanmıştır.',
            ''
        );

        lines.push(
            '## 8. Sonraki Sprint Önerileri',
            '1.  **Birim Test Kapsamını Artırın:** Test doğrulamalarını daha sıkı hale getirin.',
            '2.  **Büyük Dosyaları Parçalayın:** Dev boyuttaki kod dosyalarını küçük modüllere refactor edin.',
            ''
        );

        const summaryContent = lines.join('\n');
        const filePath = path.join(this.aiosDir, 'summary.md');
        await fs.writeFile(filePath, summaryContent, 'utf8');

        return summaryContent;
    }
}
