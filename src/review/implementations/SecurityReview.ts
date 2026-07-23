import * as fs from 'fs';
import * as path from 'path';
import { IReviewer } from '../core/IReviewer';
import { ReviewContext, ReviewerResult } from '../shared/reviewTypes';

export class SecurityReview implements IReviewer {
    public readonly name = 'SecurityReview';

    public async review(context: ReviewContext): Promise<ReviewerResult> {
        const issues: string[] = [];
        const warnings: string[] = [];
        let score = 100;

        const secretPatterns = [
            /api[-_]?key\s*=\s*['"][a-zA-Z0-9_\-]{8,}['"]/i,
            /secret\s*=\s*['"][a-zA-Z0-9_\-]{8,}['"]/i,
            /private[-_]?key\s*=\s*['"]-----BEGIN/i,
            /password\s*=\s*['"][a-zA-Z0-9_\-!@#$%^&*]{4,}['"]/i
        ];

        for (const file of context.changedFiles) {
            const absolutePath = path.isAbsolute(file) ? file : path.join(context.workspaceRoot, file);
            if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) continue;

            const content = fs.readFileSync(absolutePath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // A. Secret / Şifre sızıntı kalıpları
                for (const pattern of secretPatterns) {
                    if (pattern.test(line)) {
                        issues.push(`Güvenlik İhlali: "${path.basename(file)}:L${i + 1}" satırında açık kaynak kodlu anahtar/şifre tespiti.`);
                        score = Math.max(0, score - 30);
                    }
                }

                // B. Tehlikeli eval() kod yürütmesi
                if (line.includes('eval(') && !line.startsWith('//') && !line.startsWith('/*')) {
                    issues.push(`Güvenlik İhlali: "${path.basename(file)}:L${i + 1}" satırında tehlikeli eval() kullanımı.`);
                    score = Math.max(0, score - 20);
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
