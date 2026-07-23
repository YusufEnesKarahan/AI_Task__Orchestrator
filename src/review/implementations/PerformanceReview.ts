import * as fs from 'fs';
import * as path from 'path';
import { IReviewer } from '../core/IReviewer';
import { ReviewContext, ReviewerResult } from '../shared/reviewTypes';

export class PerformanceReview implements IReviewer {
    public readonly name = 'PerformanceReview';

    public async review(context: ReviewContext): Promise<ReviewerResult> {
        const issues: string[] = [];
        const warnings: string[] = [];
        let score = 100;

        for (const file of context.changedFiles) {
            const absolutePath = path.isAbsolute(file) ? file : path.join(context.workspaceRoot, file);
            if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) continue;

            // Test dosyalarındaki senkron okumalar performans uyarısı tetiklememeli
            if (file.includes('.test.ts') || file.includes('tests/') || file.includes('test/')) continue;

            const content = fs.readFileSync(absolutePath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Senkron dosya okuma/yazma (Sync) kontrolü
                if (line.includes('fs.') && line.includes('Sync(') && !line.startsWith('//') && !line.startsWith('/*')) {
                    warnings.push(`Performans Uyarısı: "${path.basename(file)}:L${i + 1}" satırında senkron dosya sistemi metodunun kullanımı: "${line.trim()}"`);
                    score = Math.max(0, score - 15);
                }
            }
        }

        return {
            reviewerName: this.name,
            passed: issues.length === 0, // warnings do not block passing
            issues,
            warnings,
            score
        };
    }
}
