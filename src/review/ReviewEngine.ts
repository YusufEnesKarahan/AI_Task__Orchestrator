import * as fs from 'fs';
import * as path from 'path';
import { ReviewPipeline } from './core/ReviewPipeline';
import { ReviewRegistry } from './core/ReviewRegistry';
import { ReviewMetrics } from './core/ReviewMetrics';
import { ReviewContext, ReviewReport, ReviewMetrics as IReviewMetrics } from './shared/reviewTypes';

export class ReviewEngine {
    private readonly registry = ReviewRegistry.getInstance();
    private readonly metricsTracker: ReviewMetrics;
    private readonly reviewDir: string;
    private readonly historyPath: string;

    constructor(private readonly workspaceRoot: string) {
        this.reviewDir = path.join(workspaceRoot, '.aios', 'review');
        this.historyPath = path.join(this.reviewDir, 'review-history.json');
        
        this.ensureDirExists();
        this.metricsTracker = new ReviewMetrics(path.join(this.reviewDir, 'review-metrics.json'));
    }

    private ensureDirExists() {
        if (!fs.existsSync(this.reviewDir)) {
            fs.mkdirSync(this.reviewDir, { recursive: true });
        }
    }

    /**
     * Tüm kayıtlı inceleme adımlarını değiştirilen dosyalar için çalıştırır.
     */
    public async review(changedFiles: string[]): Promise<ReviewReport> {
        const reviewers = this.registry.getAllReviewers().map(r => r.name);
        return this.reviewBatch(changedFiles, reviewers);
    }

    /**
     * Belirtilen inceleme adımlarını değiştirilen dosyalar için çalıştırır.
     */
    public async reviewBatch(changedFiles: string[], reviewers: string[]): Promise<ReviewReport> {
        const pipeline = new ReviewPipeline();
        
        for (const name of reviewers) {
            pipeline.addReviewer(name);
        }

        const context: ReviewContext = {
            workspaceRoot: this.workspaceRoot,
            changedFiles
        };

        const report = await pipeline.run(context);
        
        // Raporu ve metrikleri diske yaz
        this.saveReport(report);
        this.metricsTracker.update(report);

        return report;
    }

    /**
     * İnceleme raporu için insan tarafından okunabilir Markdown rapor kartı üretir.
     */
    public generateReport(report: ReviewReport): string {
        let md = `# Kod İnceleme Raporu (${report.reviewId})\n\n`;
        md += `- **Tarih:** ${new Date(report.timestamp).toLocaleString()}\n`;
        md += `- **Sonuç:** ${report.passed ? '✅ BAŞARILI' : '❌ BAŞARISIZ'}\n`;
        md += `- **Genel Puan:** ${report.score} / 100\n`;
        md += `- **Etkilenen Dosyalar:** ${report.targetFiles.length} adet\n\n`;

        md += `## İnceleme Detayları\n\n`;
        
        for (const res of report.results) {
            md += `### ${res.reviewerName} (${res.passed ? '✅' : '❌'} - Puan: ${res.score}/100)\n`;
            
            if (res.issues.length > 0) {
                md += `**Bulgular (Hatalar):**\n`;
                res.issues.forEach(issue => {
                    md += `- [HATA] ${issue}\n`;
                });
            }
            
            if (res.warnings.length > 0) {
                md += `**Uyarılı Durumlar:**\n`;
                res.warnings.forEach(warn => {
                    md += `- [UYARI] ${warn}\n`;
                });
            }

            if (res.issues.length === 0 && res.warnings.length === 0) {
                md += `*Herhangi bir sorun tespit edilmedi.*\n`;
            }
            
            md += `\n---\n`;
        }

        return md;
    }

    /**
     * Geçmiş inceleme raporlarını döndürür.
     */
    public getHistory(): ReviewReport[] {
        if (!fs.existsSync(this.historyPath)) return [];
        try {
            const data = fs.readFileSync(this.historyPath, 'utf-8');
            return JSON.parse(data) as ReviewReport[];
        } catch {
            return [];
        }
    }

    /**
     * Genel inceleme metriklerini döndürür.
     */
    public getMetrics(): IReviewMetrics {
        return this.metricsTracker.getMetrics();
    }

    private saveReport(report: ReviewReport) {
        const filePath = path.join(this.reviewDir, `report_${report.reviewId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');

        // Geçmiş listesini güncelle
        let history = this.getHistory();
        history.push(report);

        if (history.length > 100) {
            history.shift();
        }

        fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2), 'utf-8');
    }
}
