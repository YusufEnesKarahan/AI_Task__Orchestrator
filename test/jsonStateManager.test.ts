import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { JsonStateManager } from '../src/store/JsonStateManager';
import { createEmptyState, createPromptForTask, createTask } from './helpers';

test('JsonStateManager.replaceTasks removes orphan prompts and keeps prompts for valid tasks', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ato-state-'));
    const manager = new JsonStateManager(workspaceRoot, { fileName: 'state.test.json' });
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
