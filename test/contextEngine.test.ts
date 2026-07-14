import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ContextEngine } from '../src/context';
import { MemoryEngine } from '../src/memory';

async function createWorkspace(prefix: string): Promise<string> {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    await fs.writeFile(
        path.join(workspaceRoot, 'package.json'),
        JSON.stringify({
            name: 'context-test',
            dependencies: { zod: '^3.0.0' },
            devDependencies: { typescript: '^5.0.0', '@types/vscode': '^1.80.0' }
        }),
        'utf8'
    );
    await fs.writeFile(path.join(workspaceRoot, 'README.md'), '# Context Test', 'utf8');
    await fs.mkdir(path.join(workspaceRoot, 'src', 'services'), { recursive: true });
    await fs.writeFile(
        path.join(workspaceRoot, 'src', 'extension.ts'),
        "import { runService } from './services/runService';\nexport function activate() { runService(); }\n",
        'utf8'
    );
    await fs.writeFile(
        path.join(workspaceRoot, 'src', 'services', 'runService.ts'),
        "export function runService() { return 'ok'; }\n",
        'utf8'
    );
    return workspaceRoot;
}

async function seedMemory(workspaceRoot: string): Promise<void> {
    const memory = new MemoryEngine(workspaceRoot);
    await memory.updateStaticMemory({
        project: { name: 'Context Test', type: 'VS Code Extension' },
        technologies: ['TypeScript', 'NodeJS'],
        modules: ['src', 'test'],
        codingRules: ['Keep backward compatibility']
    });
    await memory.updateWorkingMemory({
        currentSprint: 'Sprint 4',
        currentGoal: 'Build Context Intelligence Engine',
        currentTask: 'Create context package',
        modifiedFiles: ['src/services/runService.ts'],
        recentChanges: ['Seeded memory for context tests']
    });
    await memory.addDecision({
        title: 'Use ContextEngine as context API',
        reason: 'Future prompt composer should not assemble context manually.',
        source: 'ai',
        tags: ['context', 'architecture'],
        relatedFiles: ['src/context/ContextEngine.ts']
    });
    await memory.addJournalEntry({
        summary: 'Prepared Sprint 4 context work',
        why: 'Context must combine memory and project intelligence.',
        changedFiles: ['src/context'],
        completed: ['Memory seed'],
        tags: ['sprint-4']
    });
}

test('ContextEngine builds task context with memory and project intelligence', async () => {
    const workspaceRoot = await createWorkspace('context-build-');
    await seedMemory(workspaceRoot);
    const engine = new ContextEngine(workspaceRoot);

    const context = await engine.buildTaskContext({
        title: 'Fix run service behavior',
        description: 'Bug fix around runService dependency selection',
        type: 'bug_fix',
        priority: 'high',
        relatedFiles: ['src/services/runService.ts']
    });

    assert.equal(context.agent, 'planner');
    assert.equal(context.taskType, 'bug_fix');
    assert.equal(context.memory.currentSprint, 'Sprint 4');
    assert.ok(context.knowledge.technologies.includes('TypeScript'));
    assert.ok(context.items.some((item) => item.layer === 'working'));
    assert.ok(context.items.some((item) => item.layer === 'code'));
    assert.ok(context.items.some((item) => item.layer === 'risk'));
    assert.ok(context.relatedFiles.includes('src/services/runService.ts'));
});

test('ContextEngine uses cache for repeated context requests', async () => {
    const workspaceRoot = await createWorkspace('context-cache-');
    await seedMemory(workspaceRoot);
    const engine = new ContextEngine(workspaceRoot);

    const first = await engine.buildPlannerContext({ budget: 'small' });
    const second = await engine.buildPlannerContext({ budget: 'small' });

    assert.equal(second.id, first.id);
    assert.ok(existsSync(path.join(workspaceRoot, '.aios', 'context-cache.json')));
    assert.ok(existsSync(path.join(workspaceRoot, '.aios', 'context-summary.json')));
});

test('ContextEngine scores and budgets context items', async () => {
    const workspaceRoot = await createWorkspace('context-budget-');
    await seedMemory(workspaceRoot);
    const engine = new ContextEngine(workspaceRoot);

    const context = await engine.buildContext({
        agent: 'reviewer',
        budget: 'small',
        task: {
            title: 'Review run service',
            type: 'review',
            relatedFiles: ['src/services/runService.ts']
        }
    });

    assert.ok(context.tokenEstimate <= context.tokenBudget);
    assert.ok(context.items[0].score >= context.items[context.items.length - 1].score);
    assert.ok(context.items.some((item) => item.layer === 'health'));
});

test('ContextEngine validates empty and valid context packages', async () => {
    const workspaceRoot = await createWorkspace('context-validate-');
    await seedMemory(workspaceRoot);
    const engine = new ContextEngine(workspaceRoot);
    const context = await engine.buildProjectContext();
    const valid = engine.validateContext(context);
    const invalid = engine.validateContext({ ...context, items: [] });

    assert.equal(valid.valid, true);
    assert.equal(invalid.valid, false);
    assert.ok(invalid.errors.includes('Context is empty.'));
});

test('ContextEngine can clear cache and search generated context', async () => {
    const workspaceRoot = await createWorkspace('context-search-');
    await seedMemory(workspaceRoot);
    const engine = new ContextEngine(workspaceRoot);

    await engine.buildContext({
        query: 'architecture',
        task: { title: 'Architecture planning', type: 'planning' }
    });
    const results = await engine.searchContext('architecture');
    await engine.clearCache();
    const cacheContent = JSON.parse(await fs.readFile(path.join(workspaceRoot, '.aios', 'context-cache.json'), 'utf8'));

    assert.ok(results.length > 0);
    assert.equal(cacheContent.entries.length, 0);
});
