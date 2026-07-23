import { describe, test, before, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import { GitEngine } from '../../src/git/GitEngine';
import { MockGitHost } from '../../src/git/core/MockGitHost';
import { EventBus } from '../../src/shared/events/EventBus';

const TEMP_WORKSPACE = path.join(__dirname, '..', '..', 'scratch', 'temp_workspace_git_test');

describe('Git Intelligence Tests', () => {
    let engine: GitEngine;
    let mockHost: MockGitHost;

    before(() => {
        if (!fs.existsSync(TEMP_WORKSPACE)) {
            fs.mkdirSync(TEMP_WORKSPACE, { recursive: true });
        }
        // Force mock mode by instantiating GitEngine (if no .git exists in TEMP_WORKSPACE, it falls back to MockGitHost)
        engine = new GitEngine(TEMP_WORKSPACE);
        
        // Ensure we are working with MockGitHost in tests
        mockHost = new MockGitHost();
        // Override host for deterministic testing
        Object.defineProperty(engine, 'host', { value: mockHost, writable: true });
    });

    beforeEach(() => {
        // Clear history & metrics
        const gitDir = path.join(TEMP_WORKSPACE, '.aios', 'git');
        if (fs.existsSync(gitDir)) {
            const files = fs.readdirSync(gitDir);
            for (const file of files) {
                try {
                    fs.unlinkSync(path.join(gitDir, file));
                } catch {
                    // Windows resource locks
                }
            }
        }
        mockHost.setMockBranch('main');
        mockHost.setMockStatus([], []);
        mockHost.setMockConflicts([]);
    });

    // ─── 1. Repository Detection ─────────────────────────────────────────────
    test('should verify repository is successfully opened', async () => {
        const opened = await engine.openRepository();
        assert.strictEqual(opened, true);
    });

    // ─── 2. Branch Management ────────────────────────────────────────────────
    test('should create and switch branches correctly', async () => {
        const created = await engine.createBranch('feature/sprint-15');
        assert.strictEqual(created, true);

        const status = await engine.getStatus();
        assert.strictEqual(status.currentBranch, 'feature/sprint-15');

        // Switch back to main
        const switched = await engine.switchBranch('main');
        assert.strictEqual(switched, true);

        const statusMain = await engine.getStatus();
        assert.strictEqual(statusMain.currentBranch, 'main');
    });

    // ─── 3. Diff Analysis ──────────────────────────────────────────────────
    test('should analyze diff metrics and classify changed files', async () => {
        mockHost.setMockStatus(['src/main.ts', 'tests/main.test.ts', 'docs/readme.md'], []);

        const diff = await engine.analyzeDiff();
        assert.strictEqual(diff.changedFiles, 3);
        assert.strictEqual(diff.insertions, 30);
        assert.strictEqual(diff.deletions, 6);

        const fileDiffs = diff.fileDiffs;
        assert.strictEqual(fileDiffs[0].type, 'code');
        assert.strictEqual(fileDiffs[1].type, 'test');
        assert.strictEqual(fileDiffs[2].type, 'docs');
    });

    // ─── 4. Conventional Commit Generation ──────────────────────────────────
    test('should generate Conventional Commit messages based on changed files', async () => {
        // Test changes only
        mockHost.setMockStatus(['tests/app.test.ts'], []);
        const msgTest = await engine.generateCommitMessage();
        assert.strictEqual(msgTest, 'test: add unit tests');

        // Docs changes only
        mockHost.setMockStatus(['readme.md'], []);
        const msgDocs = await engine.generateCommitMessage();
        assert.strictEqual(msgDocs, 'docs: update documentation');

        // Refactor changes only
        mockHost.setMockStatus(['src/refactor/helper.ts'], []);
        const msgRefactor = await engine.generateCommitMessage();
        assert.strictEqual(msgRefactor, 'refactor: clean up structure');

        // Bug fix filenames
        mockHost.setMockStatus(['src/bug-fix-connection.ts'], []);
        const msgBug = await engine.generateCommitMessage();
        assert.strictEqual(msgBug, 'fix: resolve bugs');

        // General code changes
        mockHost.setMockStatus(['src/app.ts'], []);
        const msgFeat = await engine.generateCommitMessage();
        assert.strictEqual(msgFeat, 'feat: implement task modules');
    });

    // ─── 5. Commit Creation ──────────────────────────────────────────────────
    test('should create commits and update metrics', async () => {
        mockHost.setMockStatus(['src/main.ts'], []);
        const hash = await engine.commit('feat: finalize sprint 15');
        assert.ok(hash.startsWith('mock_hash_'));

        const status = await engine.getStatus();
        assert.strictEqual(status.isClean, true); // Status is clean after commit

        const metrics = engine.getMetrics();
        assert.strictEqual(metrics.commitsCreated, 1);
    });

    // ─── 6. Conflict Detection ───────────────────────────────────────────────
    test('should detect merge conflicts inside conflict files and file contents', async () => {
        // 1. standard conflict indicator via host
        mockHost.setMockConflicts(['src/conflict.ts']);
        let conflicts = await engine.detectConflicts();
        assert.strictEqual(conflicts.length, 1);
        assert.strictEqual(conflicts[0], 'src/conflict.ts');

        // 2. manual scan of conflict markers inside file contents
        mockHost.setMockConflicts([]);
        const testFile = path.join(TEMP_WORKSPACE, 'manual_conflict.ts');
        fs.writeFileSync(testFile, `
<<<<<<< HEAD
const a = 1;
=======
const a = 2;
>>>>>>> feature-branch
        `, 'utf-8');

        // Mock status to include manual_conflict.ts relative to workspace
        mockHost.setMockStatus(['manual_conflict.ts'], []);
        conflicts = await engine.detectConflicts();
        
        assert.ok(conflicts.includes('manual_conflict.ts'));

        // Clean up manual file
        try {
            fs.unlinkSync(testFile);
        } catch {
            // ignore
        }
    });

    // ─── 7. EventBus Integration ─────────────────────────────────────────────
    test('should publish EventBus events during repository operations', async () => {
        const eventBus = EventBus.getInstance();
        const events: string[] = [];

        const unsub = [
            eventBus.on('RepositoryOpened', () => events.push('Opened')),
            eventBus.on('BranchCreated', () => events.push('Branch')),
            eventBus.on('CommitCreated', () => events.push('Commit')),
            eventBus.on('MergeConflictDetected', () => events.push('Conflict'))
        ];

        await engine.openRepository();
        await engine.createBranch('feature/sprint-test');
        mockHost.setMockStatus(['src/main.ts'], []);
        await engine.commit();
        
        mockHost.setMockConflicts(['src/conflict.ts']);
        await engine.detectConflicts();

        unsub.forEach(fn => fn());

        assert.ok(events.includes('Opened'));
        assert.ok(events.includes('Branch'));
        assert.ok(events.includes('Commit'));
        assert.ok(events.includes('Conflict'));

        // Verify history on disk
        const history = engine.getHistory();
        assert.ok(history.length >= 4);
    });
});
