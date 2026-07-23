import * as fs from 'fs';
import * as path from 'path';
import { IReviewer } from '../core/IReviewer';
import { ReviewContext, ReviewerResult } from '../shared/reviewTypes';

export class ArchitectureReview implements IReviewer {
    public readonly name = 'ArchitectureReview';

    public async review(context: ReviewContext): Promise<ReviewerResult> {
        const issues: string[] = [];
        const warnings: string[] = [];
        let score = 100;

        for (const file of context.changedFiles) {
            const absolutePath = path.isAbsolute(file) ? file : path.join(context.workspaceRoot, file);
            if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) continue;

            const content = fs.readFileSync(absolutePath, 'utf-8');
            const lines = content.split('\n');

            const relativePath = path.relative(context.workspaceRoot, absolutePath).replace(/\\/g, '/').toLowerCase();

            // Mimari sınırlar denetimi (Coupling & Layering)
            // Core veya Domain klasörleri üst katman (webview, execution, actions, review) modüllerini import etmemeli
            if (relativePath.includes('src/core/') || relativePath.includes('src/domain/')) {
                for (const line of lines) {
                    if (line.includes('import') && 
                        (line.includes('/webview/') || 
                         line.includes('/execution/') || 
                         line.includes('/actions/') ||
                         line.includes('/review/'))
                    ) {
                        issues.push(`Mimari İhlal: Core/Domain katmanı (${relativePath}) üst katmana ait modül import ediyor: "${line.trim()}"`);
                        score = Math.max(0, score - 25);
                    }
                }
            }
        }

        return {
            reviewerName: this.name,
            passed: issues.length === 0,
            issues,
            warnings,
            score
        };
    }
}
