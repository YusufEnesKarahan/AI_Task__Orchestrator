import * as fs from 'fs';
import * as path from 'path';
import { IReviewer } from '../core/IReviewer';
import { ReviewContext, ReviewerResult } from '../shared/reviewTypes';

export class CodeQualityReview implements IReviewer {
    public readonly name = 'CodeQualityReview';

    public async review(context: ReviewContext): Promise<ReviewerResult> {
        const issues: string[] = [];
        const warnings: string[] = [];
        let score = 100;

        for (const file of context.changedFiles) {
            const absolutePath = path.isAbsolute(file) ? file : path.join(context.workspaceRoot, file);
            if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) continue;

            const content = fs.readFileSync(absolutePath, 'utf-8');
            const lines = content.split('\n');

            // 1. Dosya boyutu kontrolü (>300 satır)
            if (lines.length > 300) {
                warnings.push(`Dosya boyutu çok büyük (${lines.length} satır). Modüller daha küçük parçalara bölünmeli.`);
                score = Math.max(0, score - 10);
            }

            // 2. İç içe geçme derinliği (Nesting Depth) kontrolü
            // Satır başlarındaki boşluklardan dallanma derinliği hesaplanır (4 space veya 1 tab = 1 derinlik)
            let maxDepth = 0;
            for (const line of lines) {
                const leadingSpaces = line.match(/^(\s*)/)?.[1] || '';
                const tabCount = (leadingSpaces.match(/\t/g) || []).length;
                const spaceCount = (leadingSpaces.match(/ /g) || []).length;
                const depth = tabCount + Math.floor(spaceCount / 4);

                if (depth > maxDepth) {
                    maxDepth = depth;
                }
            }

            if (maxDepth > 4) {
                issues.push(`Aşırı karmaşıklık: "${path.basename(file)}" içinde dallanma derinliği ${maxDepth} seviyesine ulaşıyor.`);
                score = Math.max(0, score - 20);
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
