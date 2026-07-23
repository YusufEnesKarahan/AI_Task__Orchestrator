import { describe, test, before, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import { TaskEngine } from '../../src/tasks/TaskEngine';
import { EventBus } from '../../src/shared/events/EventBus';

const TEMP_WORKSPACE = path.join(__dirname, '..', '..', 'scratch', 'temp_workspace_tasks_test');

describe('Task Intelligence Tests', () => {
    let engine: TaskEngine;

    before(() => {
        if (!fs.existsSync(TEMP_WORKSPACE)) {
            fs.mkdirSync(TEMP_WORKSPACE, { recursive: true });
        }
        engine = new TaskEngine(TEMP_WORKSPACE);
    });

    beforeEach(() => {
        // clear history json
        const historyFile = path.join(TEMP_WORKSPACE, '.aios', 'tasks', 'history.json');
        if (fs.existsSync(historyFile)) {
            try {
                fs.unlinkSync(historyFile);
            } catch {
                // Windows lock
            }
        }
    });

    // ─── 1. Markdown TODO Checklist Parsing ──────────────────────────────────
    test('should parse Markdown TODO items and map optional dependency tags', () => {
        const mdContent = `
# Project Plan
- [ ] Implement database connection (#setup-db)
- [ ] Write user endpoints (#implement-database-connection)
- [ ] Deploy api docs
        `;

        const tasks = engine.parse(mdContent, 'markdown_todo');
        
        assert.strictEqual(tasks.length, 3);
        assert.strictEqual(tasks[0].title, 'Implement database connection');
        assert.deepStrictEqual(tasks[0].dependencies, ['setup-db']);
        assert.strictEqual(tasks[1].title, 'Write user endpoints');
        assert.deepStrictEqual(tasks[1].dependencies, ['implement-database-connection']);
        assert.strictEqual(tasks[2].title, 'Deploy api docs');
        assert.deepStrictEqual(tasks[2].dependencies, []);
    });

    // ─── 2. Code Comments TODO/FIXME Parsing ────────────────────────────────
    test('should scan files for TODO and FIXME comments with context line numbers', () => {
        const fileContent = `
// TODO: Refactor authentication handler
const api = "auth";
/* FIXME: fix memory leak in connection pool */
function connect() {}
        `;

        const tasks = engine.parse(fileContent, 'code_comment', 'src/db.ts');

        assert.strictEqual(tasks.length, 2);
        
        assert.strictEqual(tasks[0].title, 'Refactor authentication handler');
        assert.strictEqual(tasks[0].category, 'refactor');
        assert.strictEqual(tasks[0].metadata?.line, 2);
        assert.strictEqual(tasks[0].metadata?.filePath, 'src/db.ts');

        assert.strictEqual(tasks[1].title, 'fix memory leak in connection pool');
        assert.strictEqual(tasks[1].category, 'bug'); // FIXME -> bug
        assert.strictEqual(tasks[1].metadata?.line, 4);
    });

    // ─── 3. GitHub Issue JSON Parsing ────────────────────────────────────────
    test('should parse GitHub Issue JSON metadata and predict category/priority', () => {
        const issuePayload = JSON.stringify({
            title: 'Security: Fix API key leak in config file',
            body: 'We found an exposed secret in code',
            labels: ['bug', 'security', 'critical']
        });

        const tasks = engine.parse(issuePayload, 'github_issue');
        
        assert.strictEqual(tasks.length, 1);
        assert.strictEqual(tasks[0].title, 'Security: Fix API key leak in config file');
        assert.strictEqual(tasks[0].priority, 'critical');
        assert.strictEqual(tasks[0].category, 'bug');
    });

    // ─── 4. Priority Scoring Heuristics ──────────────────────────────────────
    test('should prioritize tasks based on keywords in title and description', () => {
        const t1 = engine.normalize({ title: 'vulnerability found in dependency', description: '' }, 'json');
        const t2 = engine.normalize({ title: 'urgent error loading app', description: '' }, 'json');
        const t3 = engine.normalize({ title: 'refactor formatting code', description: '' }, 'json');
        const t4 = engine.normalize({ title: 'develop custom webview', description: '' }, 'json');

        assert.strictEqual(t1.priority, 'critical');
        assert.strictEqual(t2.priority, 'high');
        assert.strictEqual(t3.priority, 'low');
        assert.strictEqual(t4.priority, 'medium');
    });

    // ─── 5. Topological Dependency Sorting ──────────────────────────────────
    test('should sort tasks topologically and throw on circular dependencies', () => {
        // A -> B (A depends on B)
        // B -> C (B depends on C)
        const tA = engine.normalize({ title: 'Task A', dependencies: ['task-b'] }, 'json');
        const tB = engine.normalize({ title: 'Task B', dependencies: ['task-c'] }, 'json');
        const tC = engine.normalize({ title: 'Task C', dependencies: [] }, 'json');

        const sorted = engine.resolveDependencies([tA, tB, tC]);
        
        // Sorting should yield C first, then B, then A
        assert.strictEqual(sorted[0].id, 'task-c');
        assert.strictEqual(sorted[1].id, 'task-b');
        assert.strictEqual(sorted[2].id, 'task-a');

        // Circular check: X depends on Y, Y depends on X
        const tX = engine.normalize({ title: 'Task X', dependencies: ['task-y'] }, 'json');
        const tY = engine.normalize({ title: 'Task Y', dependencies: ['task-x'] }, 'json');

        assert.throws(() => {
            engine.resolveDependencies([tX, tY]);
        }, /Döngüsel bağımlılık/);
    });

    // ─── 6. EventBus Integration ─────────────────────────────────────────────
    test('should emit EventBus notifications during parsing and resolution', async () => {
        const eventBus = EventBus.getInstance();
        const events: string[] = [];

        const unsub = [
            eventBus.on('TaskParsed', () => events.push('Parsed')),
            eventBus.on('TaskPrioritized', () => events.push('Prioritized')),
            eventBus.on('TaskDependenciesResolved', () => events.push('Resolved'))
        ];

        // Parse a markdown task
        engine.parse('- [ ] Write auth endpoints', 'markdown_todo');
        
        // Resolve simple list
        const t = engine.normalize({ title: 'Sample' }, 'json');
        engine.resolveDependencies([t]);

        unsub.forEach(fn => fn());

        assert.ok(events.includes('Parsed'));
        assert.ok(events.includes('Prioritized'));
        assert.ok(events.includes('Resolved'));

        // Verify history on disk
        const history = engine.getHistory();
        assert.ok(history.length > 0);
    });
});
