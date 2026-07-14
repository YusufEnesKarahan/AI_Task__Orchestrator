import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DependencyAnalyzer } from '../src/intelligence/dependency/DependencyAnalyzer';
import { ProjectIntelligenceEngine } from '../src/intelligence/scanner/ProjectIntelligenceEngine';
import { TechnologyAnalyzer } from '../src/intelligence/technology/TechnologyAnalyzer';

test('TechnologyAnalyzer identifies TypeScript and NodeJS', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tech-test-'));

    // Create dummy files
    await fs.writeFile(
        path.join(workspaceRoot, 'package.json'),
        JSON.stringify({
            dependencies: {
                react: '^18.0.0',
                typescript: '^5.0.0'
            }
        }),
        'utf8'
    );
    await fs.writeFile(path.join(workspaceRoot, 'app.ts'), 'console.log("hello");', 'utf8');

    const analyzer = new TechnologyAnalyzer();
    const techs = await analyzer.analyze(workspaceRoot, [
        path.join(workspaceRoot, 'package.json'),
        path.join(workspaceRoot, 'app.ts')
    ]);

    const names = techs.map((t) => t.name);
    assert.ok(names.includes('TypeScript'));
    assert.ok(names.includes('React'));
    assert.ok(names.includes('NodeJS'));
});

test('ProjectIntelligenceEngine runs full scan and creates .aios files', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'engine-test-'));

    // Create minimal package.json and Readme
    await fs.writeFile(path.join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'test-project' }), 'utf8');
    await fs.writeFile(path.join(workspaceRoot, 'README.md'), '# Test', 'utf8');
    await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, 'src', 'extension.ts'), 'export function activate() {}', 'utf8');
    await fs.mkdir(path.join(workspaceRoot, 'src', 'webview'), { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, 'src', 'webview', 'panel.ts'), 'export const panel = true;', 'utf8');

    const engine = new ProjectIntelligenceEngine(workspaceRoot);
    const result = await engine.runFullScan();

    assert.equal(result.knowledge.projectName, path.basename(workspaceRoot));
    assert.equal(result.knowledge.architecture.type, 'VS Code Extension (Webview Host)');
    assert.ok(result.knowledge.modules.includes('src'));
    assert.ok(existsSync(path.join(workspaceRoot, '.aios', 'knowledge.json')));
    assert.ok(existsSync(path.join(workspaceRoot, '.aios', 'architecture.json')));
    assert.ok(existsSync(path.join(workspaceRoot, '.aios', 'summary.md')));
    assert.ok(existsSync(path.join(workspaceRoot, '.aios', 'health.json')));
    assert.ok(existsSync(path.join(workspaceRoot, '.aios', 'risk.json')));
});

test('DependencyAnalyzer resolves relative require relations', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dep-test-'));
    await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
    const indexPath = path.join(workspaceRoot, 'src', 'index.js');
    const utilPath = path.join(workspaceRoot, 'src', 'util.js');
    await fs.writeFile(indexPath, "const util = require('./util');\nmodule.exports = util;\n", 'utf8');
    await fs.writeFile(utilPath, 'module.exports = { ok: true };\n', 'utf8');

    const analyzer = new DependencyAnalyzer();
    const relations = await analyzer.analyze(workspaceRoot, [indexPath, utilPath]);

    assert.deepEqual(relations, [
        {
            from: 'src/index.js',
            to: 'src/util.js',
            type: 'require'
        }
    ]);
});
