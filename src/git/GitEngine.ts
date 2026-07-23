import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { EventBus } from '../shared/events/EventBus';
import { IGitHost } from './core/IGitHost';
import { GitCommandHost } from './core/GitCommandHost';
import { MockGitHost } from './core/MockGitHost';
import { CommitMessageGenerator } from './core/CommitMessageGenerator';
import { ConflictDetector } from './core/ConflictDetector';
import { GitStatus, GitDiffInfo, GitHistoryLog, GitMetrics as IGitMetrics } from './shared/gitTypes';

export class GitEngine {
    private readonly host: IGitHost;
    private readonly msgGenerator = new CommitMessageGenerator();
    private readonly conflictDetector = new ConflictDetector();
    private readonly eventBus = EventBus.getInstance();

    private readonly gitDir: string;
    private readonly historyPath: string;
    private readonly metricsPath: string;

    constructor(private readonly workspaceRoot: string) {
        this.gitDir = path.join(workspaceRoot, '.aios', 'git');
        this.historyPath = path.join(this.gitDir, 'git-history.json');
        this.metricsPath = path.join(this.gitDir, 'git-metrics.json');
        
        this.ensureDirExists();

        // Sistemde Git'in kurulu olup olmadığını denetle
        let hasGit = false;
        try {
            execSync('git --version', { stdio: 'pipe' });
            if (fs.existsSync(path.join(workspaceRoot, '.git'))) {
                hasGit = true;
            }
        } catch {
            hasGit = false;
        }

        if (hasGit) {
            this.host = new GitCommandHost(workspaceRoot);
        } else {
            this.host = new MockGitHost();
        }
    }

    private ensureDirExists() {
        if (!fs.existsSync(this.gitDir)) {
            fs.mkdirSync(this.gitDir, { recursive: true });
        }
    }

    /**
     * Dışarıdan MockGitHost'a doğrudan müdahale etmek için host nesnesini döndürür.
     */
    public getHost(): IGitHost {
        return this.host;
    }

    public async openRepository(): Promise<boolean> {
        const opened = await this.host.openRepository();
        if (opened) {
            this.logAndEmit('RepositoryOpened', { repositoryRoot: this.workspaceRoot });
        }
        return opened;
    }

    public async getStatus(): Promise<GitStatus> {
        return this.host.getStatus();
    }

    public async createBranch(branchName: string): Promise<boolean> {
        const created = await this.host.createBranch(branchName);
        if (created) {
            this.logAndEmit('BranchCreated', { branchName });
            this.updateMetrics('branchesCreated');
        }
        return created;
    }

    public async switchBranch(branchName: string): Promise<boolean> {
        const switched = await this.host.switchBranch(branchName);
        if (switched) {
            this.logAndEmit('BranchSwitched', { branchName });
        }
        return switched;
    }

    public async analyzeDiff(): Promise<GitDiffInfo> {
        const diff = await this.host.analyzeDiff();
        this.logAndEmit('DiffAnalyzed', { changedFilesCount: diff.changedFiles });
        return diff;
    }

    public async generateCommitMessage(diffInfo?: GitDiffInfo): Promise<string> {
        const diff = diffInfo || await this.host.analyzeDiff();
        const msg = this.msgGenerator.generate(diff);
        this.logAndEmit('CommitGenerated', { message: msg });
        return msg;
    }

    public async commit(message?: string): Promise<string> {
        const finalMsg = message || await this.generateCommitMessage();
        const hash = await this.host.commit(finalMsg);
        this.logAndEmit('CommitCreated', { hash, message: finalMsg });
        this.updateMetrics('commitsCreated');
        return hash;
    }

    public async detectConflicts(): Promise<string[]> {
        const conflictingFiles = await this.host.detectConflicts();

        // Ayrıca değiştirilen/yeni eklenen dosyalarda <<< markers taraması yapalım
        const status = await this.host.getStatus();
        const allFiles = [...status.modifiedFiles, ...status.untrackedFiles];
        const detected: string[] = [...conflictingFiles];

        for (const relativePath of allFiles) {
            const absolutePath = path.resolve(this.workspaceRoot, relativePath);
            if (fs.existsSync(absolutePath) && !detected.includes(relativePath)) {
                try {
                    const content = fs.readFileSync(absolutePath, 'utf-8');
                    if (this.conflictDetector.hasConflictMarkers(content)) {
                        detected.push(relativePath);
                    }
                } catch {
                    // ignore
                }
            }
        }

        if (detected.length > 0) {
            detected.forEach(filePath => {
                this.logAndEmit('MergeConflictDetected', { filePath });
                this.updateMetrics('conflictsDetected');
            });
        }

        return detected;
    }

    public getHistory(): GitHistoryLog[] {
        if (!fs.existsSync(this.historyPath)) return [];
        try {
            const data = fs.readFileSync(this.historyPath, 'utf-8');
            return JSON.parse(data) as GitHistoryLog[];
        } catch {
            return [];
        }
    }

    public getMetrics(): IGitMetrics {
        if (!fs.existsSync(this.metricsPath)) {
            return {
                commitsCreated: 0,
                branchesCreated: 0,
                conflictsDetected: 0
            };
        }
        try {
            const data = fs.readFileSync(this.metricsPath, 'utf-8');
            return JSON.parse(data) as IGitMetrics;
        } catch {
            return {
                commitsCreated: 0,
                branchesCreated: 0,
                conflictsDetected: 0
            };
        }
    }

    private logAndEmit(eventName: string, payload: any) {
        const log: GitHistoryLog = {
            eventId: `git_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            eventName,
            timestamp: Date.now(),
            payload
        };

        this.eventBus.emit(eventName, payload);
        
        let history = this.getHistory();
        history.push(log);
        if (history.length > 100) {
            history.shift();
        }
        fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2), 'utf-8');
    }

    private updateMetrics(field: keyof IGitMetrics) {
        const metrics = this.getMetrics();
        metrics[field]++;
        fs.writeFileSync(this.metricsPath, JSON.stringify(metrics, null, 2), 'utf-8');
    }
}
