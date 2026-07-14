import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MemoryEngine } from '../src/memory';
import { EventBus } from '../src/shared/events/EventBus';

async function createWorkspace(prefix: string): Promise<string> {
    return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test('MemoryEngine.loadMemory creates all memory files', async () => {
    const workspaceRoot = await createWorkspace('memory-init-');
    const engine = new MemoryEngine(workspaceRoot);

    const snapshot = await engine.loadMemory();
    const aiosDir = path.join(workspaceRoot, '.aios');

    assert.equal(snapshot.static.staticMemory.technologies.length, 0);
    assert.ok(existsSync(path.join(aiosDir, 'memory.json')));
    assert.ok(existsSync(path.join(aiosDir, 'working-memory.json')));
    assert.ok(existsSync(path.join(aiosDir, 'decisions.json')));
    assert.ok(existsSync(path.join(aiosDir, 'journal.json')));
    assert.ok(existsSync(path.join(aiosDir, 'memory-index.json')));
});

test('MemoryEngine updates working memory, decisions, journal, and search index', async () => {
    const workspaceRoot = await createWorkspace('memory-api-');
    const engine = new MemoryEngine(workspaceRoot);
    const bus = EventBus.getInstance();
    const events: string[] = [];

    const unsubWorking = bus.on('WorkingMemoryUpdated', () => events.push('working'));
    const unsubDecision = bus.on('DecisionAdded', () => events.push('decision'));
    const unsubJournal = bus.on('JournalAdded', () => events.push('journal'));

    try {
        await engine.updateStaticMemory({
            project: { name: 'AI Task Orchestrator', type: 'VS Code Extension' },
            technologies: ['TypeScript', 'NodeJS'],
            modules: ['src', 'test'],
            codingRules: ['Keep backward compatibility'],
            longTermMemory: {
                technicalDebt: ['Improve dependency graph precision']
            }
        });

        await engine.updateWorkingMemory({
            currentSprint: 'Sprint 3',
            currentGoal: 'Build Memory Engine',
            currentTask: 'Add Memory API',
            modifiedFiles: ['src/memory/MemoryEngine.ts'],
            recentChanges: ['Created memory API']
        });

        const decision = await engine.addDecision({
            title: 'Use file-backed memory documents',
            reason: 'Keeps local state inspectable and easy to migrate.',
            source: 'ai',
            status: 'accepted',
            tags: ['memory', 'architecture'],
            relatedFiles: ['src/memory/MemoryEngine.ts']
        });

        const journal = await engine.addJournalEntry({
            summary: 'Implemented Memory Engine skeleton',
            why: 'Sprint 3 requires persistent project memory.',
            changedFiles: ['src/memory/MemoryEngine.ts'],
            completed: ['Memory API'],
            nextStep: 'Integrate context builder',
            tags: ['sprint-3']
        });

        const results = await engine.searchMemory('memory architecture', { limit: 5 });
        const snapshot = await engine.loadMemory();

        assert.equal(decision.source, 'ai');
        assert.equal(journal.completed[0], 'Memory API');
        assert.ok(snapshot.working.workingMemory.modifiedFiles.includes('src/memory/MemoryEngine.ts'));
        assert.ok(results.some((result) => result.layer === 'decision'));
        assert.deepEqual(events.sort(), ['decision', 'journal', 'working']);
    } finally {
        unsubWorking();
        unsubDecision();
        unsubJournal();
    }
});

test('MemoryEngine migrates missing fields with defaults', async () => {
    const workspaceRoot = await createWorkspace('memory-migrate-');
    const aiosDir = path.join(workspaceRoot, '.aios');
    await fs.mkdir(aiosDir, { recursive: true });
    await fs.writeFile(
        path.join(aiosDir, 'memory.json'),
        JSON.stringify({
            schemaVersion: 1,
            createdAt: 1,
            updatedAt: 1,
            staticMemory: {
                technologies: ['TypeScript']
            }
        }),
        'utf8'
    );

    const engine = new MemoryEngine(workspaceRoot);
    const snapshot = await engine.loadMemory();

    assert.deepEqual(snapshot.static.staticMemory.technologies, ['TypeScript']);
    assert.deepEqual(snapshot.static.staticMemory.modules, []);
    assert.deepEqual(snapshot.static.longTermMemory.userPreferences, []);
    assert.deepEqual(snapshot.working.workingMemory.openProblems, []);
});

test('MemoryEngine heals corrupt memory documents', async () => {
    const workspaceRoot = await createWorkspace('memory-corrupt-');
    const aiosDir = path.join(workspaceRoot, '.aios');
    await fs.mkdir(aiosDir, { recursive: true });
    await fs.writeFile(path.join(aiosDir, 'decisions.json'), '{ not valid json', 'utf8');

    const engine = new MemoryEngine(workspaceRoot);
    const snapshot = await engine.loadMemory();
    const healedContent = await fs.readFile(path.join(aiosDir, 'decisions.json'), 'utf8');

    assert.deepEqual(snapshot.decisions.decisions, []);
    assert.doesNotThrow(() => JSON.parse(healedContent));
});

test('MemoryEngine.clearMemory resets documents and keeps files present', async () => {
    const workspaceRoot = await createWorkspace('memory-clear-');
    const engine = new MemoryEngine(workspaceRoot);

    await engine.addDecision({
        title: 'Temporary decision',
        reason: 'Validate clear behavior.',
        source: 'user'
    });
    const cleared = await engine.clearMemory();

    assert.equal(cleared.decisions.decisions.length, 0);
    assert.equal(cleared.journal.entries.length, 0);
    assert.ok(existsSync(path.join(workspaceRoot, '.aios', 'memory-index.json')));
});
