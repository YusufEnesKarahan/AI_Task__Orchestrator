import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as path from 'path';
import { AIOSRiskReport, IProjectAnalyzer } from '../shared/intelligenceTypes';

export class RiskAnalyzer implements IProjectAnalyzer {
    public async analyze(workspaceRoot: string, filePaths: string[]): Promise<AIOSRiskReport> {
        const largeFiles: string[] = [];
        const largeComponents: string[] = [];
        const unusedFiles: string[] = [];
        const duplicateGroups = new Map<string, string[]>();

        // Dev dosya analizi (100KB'tan büyük kod dosyalarını listele)
        for (const filePath of filePaths) {
            const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
            const isCodeFile = /\.(ts|tsx|js|jsx)$/.test(filePath);

            if (isCodeFile) {
                try {
                    const stat = await fs.stat(filePath);
                    if (stat.size > 102400) {
                        // 100 KB
                        largeFiles.push(relativePath);
                    }
                    if (/\.(tsx|jsx)$/.test(filePath) && stat.size > 51200) {
                        largeComponents.push(relativePath);
                    }

                    const content = await fs.readFile(filePath, 'utf8');
                    const normalizedContent = content.replace(/\s+/g, ' ').trim();
                    if (normalizedContent.length > 200) {
                        const fingerprint = crypto.createHash('sha1').update(normalizedContent).digest('hex');
                        const matches = duplicateGroups.get(fingerprint) || [];
                        matches.push(relativePath);
                        duplicateGroups.set(fingerprint, matches);
                    }
                } catch {}
            }

            // Unused/Artık dosya tespiti (Yedekler veya geçici dosyalar)
            if (filePath.endsWith('.tmp') || filePath.endsWith('.backup') || filePath.endsWith('.bak')) {
                unusedFiles.push(relativePath);
            }
        }

        const duplicateCode = Array.from(duplicateGroups.values())
            .filter((group) => group.length > 1)
            .map((group) => group.join(' <-> '));

        return {
            deadCode: [],
            duplicateCode,
            largeFiles,
            largeComponents,
            unusedImports: [],
            unusedFiles,
            circularDependencies: [],
            architectureViolations: [],
            longFunctions: [],
            largeClasses: [],
            magicNumbers: [],
            hardcodedStrings: []
        };
    }
}
