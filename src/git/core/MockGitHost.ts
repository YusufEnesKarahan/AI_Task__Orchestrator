import { IGitHost } from './IGitHost';
import { GitStatus, GitDiffInfo, FileDiffSummary } from '../shared/gitTypes';

export class MockGitHost implements IGitHost {
    private currentBranch = 'main';
    private readonly branches = new Set<string>(['main']);
    private modifiedFiles: string[] = [];
    private untrackedFiles: string[] = [];
    private conflictFiles: string[] = [];

    public async openRepository(): Promise<boolean> {
        return true;
    }

    public setMockBranch(branchName: string) {
        this.currentBranch = branchName;
        this.branches.add(branchName);
    }

    public setMockStatus(modified: string[], untracked: string[]) {
        this.modifiedFiles = modified;
        this.untrackedFiles = untracked;
    }

    public setMockConflicts(conflicts: string[]) {
        this.conflictFiles = conflicts;
    }

    public async getStatus(): Promise<GitStatus> {
        return {
            currentBranch: this.currentBranch,
            isClean: this.modifiedFiles.length === 0 && this.untrackedFiles.length === 0,
            modifiedFiles: this.modifiedFiles,
            untrackedFiles: this.untrackedFiles
        };
    }

    public async createBranch(branchName: string): Promise<boolean> {
        this.branches.add(branchName);
        this.currentBranch = branchName;
        return true;
    }

    public async switchBranch(branchName: string): Promise<boolean> {
        if (this.branches.has(branchName)) {
            this.currentBranch = branchName;
            return true;
        }
        return false;
    }

    public async analyzeDiff(): Promise<GitDiffInfo> {
        const fileDiffs: FileDiffSummary[] = this.modifiedFiles.map(filePath => {
            let type: 'test' | 'code' | 'docs' | 'refactor' | 'unknown' = 'code';
            if (filePath.includes('test') || filePath.includes('.spec.')) type = 'test';
            else if (filePath.includes('docs') || filePath.endsWith('.md')) type = 'docs';
            else if (filePath.includes('refactor')) type = 'refactor';

            return {
                filePath,
                additions: 10,
                deletions: 2,
                type
            };
        });

        return {
            changedFiles: fileDiffs.length,
            insertions: fileDiffs.length * 10,
            deletions: fileDiffs.length * 2,
            fileDiffs
        };
    }

    public async commit(message: string): Promise<string> {
        this.modifiedFiles = [];
        this.untrackedFiles = [];
        return `mock_hash_${Date.now()}`;
    }

    public async detectConflicts(): Promise<string[]> {
        return this.conflictFiles;
    }
}
