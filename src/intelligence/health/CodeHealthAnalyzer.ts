import { AIOSHealthReport, IProjectAnalyzer } from '../shared/intelligenceTypes';

export class CodeHealthAnalyzer implements IProjectAnalyzer {
    public async analyze(workspaceRoot: string, filePaths: string[]): Promise<AIOSHealthReport> {
        void workspaceRoot;

        // Temel metrik hesaplamaları için dosya türü sayıları
        const testFiles = filePaths.filter(
            (p) => p.toLowerCase().includes('.test.') || p.toLowerCase().includes('.spec.')
        );
        const docFiles = filePaths.filter((p) => p.toLowerCase().endsWith('.md') || p.toLowerCase().endsWith('.txt'));
        const totalFiles = filePaths.length || 1;

        // 1. Testing Score (Test dosyası oranı)
        const testRatio = testFiles.length / totalFiles;
        const testing = Math.min(100, Math.round(15 + testRatio * 500)); // test dosyası varsa yüksek skor

        // 2. Documentation Score (Belge dosyası oranı)
        const hasReadme = filePaths.some((p) => p.toLowerCase().endsWith('readme.md'));
        let documentation = Math.min(100, Math.round(10 + (docFiles.length / totalFiles) * 200));
        if (hasReadme) documentation = Math.min(100, documentation + 40);

        // 3. Complexity Score (Dosya boyutu ve dosya sayısına göre heuristic)
        // Çok fazla dosya varsa veya çok devasa dosyalar varsa karmaşıklık artar, skor düşer
        const complexity = Math.max(10, Math.min(100, Math.round(90 - totalFiles / 30)));

        // 4. Maintainability (Bakım yapılabilirlik)
        // Karmaşıklık, dokümantasyon ve test skoru ortalamasına yakın bir değer
        const maintainability = Math.round(complexity * 0.4 + documentation * 0.3 + testing * 0.3);

        // 5. Architecture Score
        const architectureScore = Math.round(maintainability * 0.6 + complexity * 0.4);

        // 6. Security (Temel placeholder / kural bazlı)
        const hasLockFile = filePaths.some(
            (p) => p.includes('package-lock.json') || p.includes('yarn.lock') || p.includes('pnpm-lock.yaml')
        );
        const security = hasLockFile ? 85 : 60;

        // 7. Performance (Placeholder)
        const performance = 80;

        // 8. Technical Debt (Teknik Borç: 100 - maintainability)
        const technicalDebt = Math.max(0, 100 - maintainability);

        return {
            architectureScore,
            maintainability,
            complexity,
            documentation,
            testing,
            performance,
            security,
            technicalDebt
        };
    }
}
