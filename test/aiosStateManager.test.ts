import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AiosStateManager } from '../src/store/AiosStateManager';
import { createEmptyState, createPromptForTask, createTask } from './helpers';

test('AiosStateManager.init splits files under .aios/ directory', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-state-'));
    const manager = new AiosStateManager(workspaceRoot);

    await manager.init();

    const aiosDir = path.join(workspaceRoot, '.aios');
    assert.ok(existsSync(path.join(aiosDir, 'project.json')));
    assert.ok(existsSync(path.join(aiosDir, 'tasks.json')));
    assert.ok(existsSync(path.join(aiosDir, 'logs.json')));
});

test('AiosStateManager can migrate from old .vscode/ai-orchestrator-state.json', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-migrate-'));
    const vscodeDir = path.join(workspaceRoot, '.vscode');
    await fs.mkdir(vscodeDir, { recursive: true });

    const oldStateFilePath = path.join(vscodeDir, 'ai-orchestrator-state.json');
    const oldState = createEmptyState({
        tasks: [createTask('task_migrated')],
        prompts: [createPromptForTask('task_migrated', 'prompt_migrated')]
    });

    await fs.writeFile(oldStateFilePath, JSON.stringify(oldState, null, 2), 'utf8');

    const manager = new AiosStateManager(workspaceRoot);
    await manager.init();

    // Check old file has been renamed/backed up
    assert.ok(!existsSync(oldStateFilePath));
    assert.ok(existsSync(`${oldStateFilePath}.backup`));

    // Check data loaded correctly
    const state = await manager.getState();
    assert.equal(state.tasks[0].id, 'task_migrated');
    assert.equal(state.prompts[0].id, 'prompt_migrated');
});

test('AiosStateManager.replaceTasks removes orphan prompts and keeps prompts for valid tasks', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-replace-'));
    const manager = new AiosStateManager(workspaceRoot);
    const validTask = createTask('task_valid');
    const orphanTask = createTask('task_orphan');
    const validPrompt = createPromptForTask(validTask.id, 'prompt_valid');
    const orphanPrompt = createPromptForTask(orphanTask.id, 'prompt_orphan');

    await manager.init();
    await manager.saveState(
        createEmptyState({
            tasks: [validTask, orphanTask],
            prompts: [validPrompt, orphanPrompt]
        })
    );

    await manager.replaceTasks([validTask]);
    const state = await manager.getState();

    assert.deepEqual(
        state.tasks.map((task) => task.id),
        [validTask.id]
    );
    assert.deepEqual(
        state.prompts.map((prompt) => prompt.id),
        [validPrompt.id]
    );
});
