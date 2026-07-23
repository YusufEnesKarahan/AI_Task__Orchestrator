import { execSync } from 'child_process';
import { IGitHost } from './IGitHost';
import { GitStatus, GitDiffInfo, FileDiffSummary } from '../shared/gitTypes';

export class GitCommandHost implements IGitHost {
    constructor(private readonly workspaceRoot: string) {}

    private runCmd(args: string): string {
        try {
            return execSync(`git ${args}`, { cwd: this.workspaceRoot, encoding: 'utf-8', stdio: 'pipe' }).trim();
        } catch (err: any) {
            throw new Error(`Git komut hatası (git ${args}): ${err.message}`);
        }
    }

    public async openRepository(): Promise<boolean> {
        try {
            this.runCmd('rev-parse --is-inside-work-tree');
            return true;
        } catch {
            try {
                this.runCmd('init');
                return true;
            } catch {
                return false;
            }
        }
    }

    public async getStatus(): Promise<GitStatus> {
        let currentBranch = 'main';
        try {
            currentBranch = this.runCmd('branch --show-current');
        } catch {
            // ignore
        }

        const porcelain = this.runCmd('status --porcelain');
        const modifiedFiles: string[] = [];
        const untrackedFiles: string[] = [];

        if (porcelain) {
            const lines = porcelain.split('\n');
            for (const line of lines) {
                const status = line.slice(0, 2);
                const filePath = line.slice(3).trim();
                if (status.includes('M') || status.includes('A')) {
                    modifiedFiles.push(filePath);
                } else if (status.includes('?')) {
                    untrackedFiles.push(filePath);
                }
            }
        }

        return {
            currentBranch,
            isClean: modifiedFiles.length === 0 && untrackedFiles.length === 0,
            modifiedFiles,
            untrackedFiles
        };
    }

    public async createBranch(branchName: string): Promise<boolean> {
        try {
            this.runCmd(`checkout -b ${branchName}`);
            return true;
        } catch {
            return false;
        }
    }

    public async switchBranch(branchName: string): Promise<boolean> {
        try {
            this.runCmd(`checkout ${branchName}`);
            return true;
        } catch {
            return false;
        }
    }

    public async analyzeDiff(): Promise<GitDiffInfo> {
        const numstat = this.runCmd('diff --numstat');
        const fileDiffs: FileDiffSummary[] = [];
        let insertions = 0;
        let deletions = 0;

        if (numstat) {
            const lines = numstat.split('\n');
            for (const line of lines) {
                const parts = line.split(/\s+/);
                if (parts.length >= 3) {
                    const add = parseInt(parts[0], 10) || 0;
                    const del = parseInt(parts[1], 10) || 0;
                    const filePath = parts[2];
                    insertions += add;
                    deletions += del;

                    let type: 'test' | 'code' | 'docs' | 'refactor' | 'unknown' = 'code';
                    if (filePath.includes('test') || filePath.includes('.spec.')) type = 'test';
                    else if (filePath.includes('docs') || filePath.endsWith('.md')) type = 'docs';
                    else if (filePath.includes('refactor')) type = 'refactor';

                    fileDiffs.push({
                        filePath,
                        additions: add,
                        deletions: del,
                        type
                    });
                }
            }
        }

        return {
            changedFiles: fileDiffs.length,
            insertions,
            deletions,
            fileDiffs
        };
    }

    public async commit(message: string): Promise<string> {
        this.runCmd('add .');
        const output = this.runCmd(`commit -m "${message}"`);
        const match = output.match(/\[([^\]]+)\s+([a-f0-9]+)\]/);
        return match ? match[2] : `hash_${Date.now()}`;
    }

    public async detectConflicts(): Promise<string[]> {
        try {
            const output = this.runCmd('diff --name-only --diff-filter=U');
            return output ? output.split('\n').filter(Boolean) : [];
        } catch {
            return [];
        }
    }
}
