import { describe, test, before, beforeEach, after } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import { IDEBridge } from '../../src/bridge/IDEBridge';
import { MockIDEHost } from '../../src/bridge/core/MockIDEHost';
import { EventBus } from '../../src/shared/events/EventBus';

const TEMP_WORKSPACE = path.join(__dirname, '..', '..', 'scratch', 'temp_workspace_bridge_test');

describe('IDE Bridge Tests', () => {
    let bridge: IDEBridge;
    let mockHost: MockIDEHost;

    before(() => {
        if (!fs.existsSync(TEMP_WORKSPACE)) {
            fs.mkdirSync(TEMP_WORKSPACE, { recursive: true });
        }
        bridge = new IDEBridge(TEMP_WORKSPACE);
        mockHost = bridge.getHost() as MockIDEHost;
    });

    beforeEach(() => {
        const cleanDir = (dir: string) => {
            if (!fs.existsSync(dir)) return;
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                if (item === '.aios') continue;
                try {
                    if (fs.statSync(fullPath).isDirectory()) {
                        cleanDir(fullPath);
                        fs.rmdirSync(fullPath);
                    } else {
                        fs.unlinkSync(fullPath);
                    }
                } catch {
                    // Windows resource locks
                }
            }
        };
        cleanDir(TEMP_WORKSPACE);
    });

    after(() => {
        mockHost.dispose();
    });

    // ─── 1. Active Editor & Selection ────────────────────────────────────────
    test('should retrieve mock active editor and selection information', async () => {
        mockHost.setMockEditor({
            filePath: 'src/main.ts',
            content: 'console.log("hello world");',
            languageId: 'typescript'
        });

        mockHost.setMockSelection({
            text: 'hello world',
            startLine: 1,
            endLine: 1
        });

        const editor = bridge.getActiveEditor();
        assert.ok(editor);
        assert.strictEqual(editor?.filePath, 'src/main.ts');
        assert.strictEqual(editor?.languageId, 'typescript');

        const selection = bridge.getSelection();
        assert.ok(selection);
        assert.strictEqual(selection?.text, 'hello world');
    });

    // ─── 2. Workspace & Diagnostics ──────────────────────────────────────────
    test('should fetch workspace metadata and list diagnostic errors', async () => {
        const ws = bridge.getWorkspace();
        assert.strictEqual(ws.workspaceRoot, TEMP_WORKSPACE);

        mockHost.setMockDiagnostics([
            {
                filePath: 'src/main.ts',
                message: 'Missing semicolon',
                severity: 'warning',
                line: 1
            },
            {
                filePath: 'src/main.ts',
                message: 'Unexpected token',
                severity: 'error',
                line: 2
            }
        ]);

        const diags = bridge.showDiagnostics();
        assert.strictEqual(diags.length, 2);
        assert.strictEqual(diags[0].severity, 'warning');
        assert.strictEqual(diags[1].severity, 'error');
    });

    // ─── 3. Command Execution ────────────────────────────────────────────────
    test('should execute registered command handlers', async () => {
        let commandCalled = false;
        mockHost.registerMockCommand('aios.runCommand', async (param: string) => {
            commandCalled = true;
            return `Result: ${param}`;
        });

        const res = await bridge.executeCommand('aios.runCommand', 'arg1');
        assert.strictEqual(commandCalled, true);
        assert.strictEqual(res, 'Result: arg1');
    });

    // ─── 4. EventBus Integration ─────────────────────────────────────────────
    test('should publish EventBus events for editor opened, selection, and diagnostics', async () => {
        const eventBus = EventBus.getInstance();
        const events: string[] = [];

        const unsub = [
            eventBus.on('EditorOpened', () => events.push('Open')),
            eventBus.on('SelectionChanged', () => events.push('Select')),
            eventBus.on('DiagnosticWarningAdded', () => events.push('DiagWarning')),
            eventBus.on('BridgeCommandExecuted', () => events.push('Cmd'))
        ];

        // Trigger Editor Open
        mockHost.setMockEditor({ filePath: 'foo.ts', content: '', languageId: '' });
        bridge.getActiveEditor();

        // Trigger Selection
        mockHost.setMockSelection({ text: 'text', startLine: 1, endLine: 1 });
        bridge.getSelection();

        // Trigger Diagnostics warning
        mockHost.setMockDiagnostics([{ filePath: 'foo.ts', message: 'err', severity: 'error', line: 1 }]);
        bridge.showDiagnostics();

        // Trigger Command
        await bridge.executeCommand('test');

        unsub.forEach(fn => fn());

        assert.ok(events.includes('Open'));
        assert.ok(events.includes('Select'));
        assert.ok(events.includes('DiagWarning'));
        assert.ok(events.includes('Cmd'));

        // Verify metrics
        const metrics = bridge.getMetrics();
        assert.ok(metrics.totalEvents >= 4);
    });

    // ─── 5. File Watcher Sim ─────────────────────────────────────────────────
    test('should trigger watcher callback on workspace file modifications', async (context) => {
        let fileChanged = '';
        bridge.watchWorkspace((filePath) => {
            fileChanged = filePath;
        });

        // Simüle etmek için test workspace'ine dosya yazıp tetiklenmesini bekleyelim
        const testFile = path.join(TEMP_WORKSPACE, 'watch_test.txt');
        fs.writeFileSync(testFile, 'watch content', 'utf-8');

        // Watchers asenkron tetikleneceği için kısa bir süre bekleyelim
        await new Promise(resolve => setTimeout(resolve, 50));

        assert.ok(fileChanged.includes('watch_test.txt'));
    });
});
