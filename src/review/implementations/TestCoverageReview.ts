import * as fs from 'fs';
import * as path from 'path';
import { IReviewer } from '../core/IReviewer';
import { ReviewContext, ReviewerResult } from '../shared/reviewTypes';

export class TestCoverageReview implements IReviewer {
    public readonly name = 'TestCoverageReview';

    public async review(context: ReviewContext): Promise<ReviewerResult> {
        const issues: string[] = [];
        const warnings: string[] = [];
        let score = 100;

        const codeFiles = context.changedFiles.filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
        const testFiles = context.changedFiles.filter(f => f.endsWith('.test.ts'));

        for (const file of codeFiles) {
            const filename = path.basename(file, '.ts');
            
            // A. Değişiklik listesinde testi zaten var mı?
            const isCoveredInChange = testFiles.some(tf => tf.includes(filename));
            if (isCoveredInChange) continue;

            // B. Disk üzerinde testi var mı?
            const testFileName = `${filename}.test.ts`;
            const possiblePaths = [
                path.join(context.workspaceRoot, 'tests', testFileName),
                path.join(context.workspaceRoot, 'test', testFileName),
                path.join(path.dirname(file), testFileName),
                // check nested tests directory if source path has one
                path.join(context.workspaceRoot, 'tests', path.relative(context.workspaceRoot, path.dirname(file)), testFileName)
            ];

            const exists = possiblePaths.some(p => fs.existsSync(p));
            if (!exists) {
                issues.push(`Test Eksikliği: "${path.basename(file)}" dosyası için ilişkili test dosyası (*.test.ts) bulunamadı.`);
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
