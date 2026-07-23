import { GitDiffInfo } from '../shared/gitTypes';

export class CommitMessageGenerator {
    /**
     * Değişiklik özetine (diff info) göre Conventional Commit formatında bir commit mesajı üretir.
     */
    public generate(diffInfo: GitDiffInfo): string {
        if (diffInfo.changedFiles === 0) {
            return 'chore: no changes detected';
        }

        const types = new Set(diffInfo.fileDiffs.map(d => d.type));

        // Tek tip bir değişiklik varsa doğrudan o tipe uygun prefix verilir
        if (types.size === 1) {
            const singleType = Array.from(types)[0];
            if (singleType === 'test') return 'test: add unit tests';
            if (singleType === 'docs') return 'docs: update documentation';
            if (singleType === 'refactor') return 'refactor: clean up structure';
        }

        // Dosya adlarında "fix", "bug" veya "patch" geçiyorsa düzeltmedir
        const hasFix = diffInfo.fileDiffs.some(d => 
            d.filePath.toLowerCase().includes('fix') || 
            d.filePath.toLowerCase().includes('bug')
        );

        if (hasFix) {
            return 'fix: resolve bugs';
        }

        // Varsayılan: Yeni özellik ekleme
        return 'feat: implement task modules';
    }
}
