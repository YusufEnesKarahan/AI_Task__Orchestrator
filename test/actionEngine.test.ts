import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { installVscodeMock } from './helpers';

type ResolvePathCapable = {
    resolvePath(relativePath: string): string;
};

test('ActionEngine.resolvePath accepts paths inside the workspace', async () => {
    installVscodeMock();
    const { ActionEngine } = await import('../src/services/action/ActionEngine.js');
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ato-workspace-'));
    const engine = new ActionEngine({} as any, workspaceRoot) as unknown as ResolvePathCapable;

    assert.equal(
        engine.resolvePath(path.join('src', 'index.ts')),
        path.resolve(workspaceRoot, 'src', 'index.ts')
    );
});

test('ActionEngine.resolvePath rejects parent-directory traversal', async () => {
    installVscodeMock();
    const { ActionEngine } = await import('../src/services/action/ActionEngine.js');
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ato-workspace-'));
    const engine = new ActionEngine({} as any, workspaceRoot) as unknown as ResolvePathCapable;

    assert.throws(
        () => engine.resolvePath(path.join('..', 'outside.txt')),
        /Güvenlik ihlali|GÃ¼venlik ihlali/
    );
});

test('ActionEngine.resolvePath rejects sibling directories with similar prefixes', async () => {
    installVscodeMock();
    const { ActionEngine } = await import('../src/services/action/ActionEngine.js');
    const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'ato-parent-'));
    const workspaceRoot = path.join(parent, 'project');
    const siblingPath = path.join(parent, 'project-other', 'secret.txt');
    await fs.mkdir(workspaceRoot);
    const engine = new ActionEngine({} as any, workspaceRoot) as unknown as ResolvePathCapable;

    assert.throws(
        () => engine.resolvePath(path.relative(workspaceRoot, siblingPath)),
        /Güvenlik ihlali|GÃ¼venlik ihlali/
    );
});

test('ActionEngine.resolvePath handles Windows-style separators safely', async () => {
    installVscodeMock();
    const { ActionEngine } = await import('../src/services/action/ActionEngine.js');
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ato-workspace-'));
    const engine = new ActionEngine({} as any, workspaceRoot) as unknown as ResolvePathCapable;

    assert.equal(
        engine.resolvePath('nested\\file.txt'),
        path.resolve(workspaceRoot, 'nested\\file.txt')
    );

    assert.throws(
        () => engine.resolvePath('..\\outside.txt'),
        /Güvenlik ihlali|GÃ¼venlik ihlali/
    );
});
