import { describe, test, before, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import { ActionEngine } from '../../src/actions/ActionEngine';
import { EventBus } from '../../src/shared/events/EventBus';

const TEMP_WORKSPACE = path.join(__dirname, '..', '..', 'scratch', 'temp_workspace_actions_test');

describe('Action Engine Tests', () => {

    before(() => {
        if (!fs.existsSync(TEMP_WORKSPACE)) {
            fs.mkdirSync(TEMP_WORKSPACE, { recursive: true });
        }
    });

    beforeEach(() => {
        // clean files in temp workspace
        const cleanDir = (dir: string) => {
            if (!fs.existsSync(dir)) return;
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                if (item === '.aios') continue; // keep state config
                try {
                    if (fs.statSync(fullPath).isDirectory()) {
                        cleanDir(fullPath);
                        fs.rmdirSync(fullPath);
                    } else {
                        fs.unlinkSync(fullPath);
                    }
                } catch (e) {
                    // Ignore locked resource errors during test cleanup
                }
            }
        };
        cleanDir(TEMP_WORKSPACE);
    });

    // ─── 1. File Operations ──────────────────────────────────────────────────
    test('should handle individual file creation, edit, rename, move and delete actions', async () => {
        const engine = new ActionEngine(TEMP_WORKSPACE);
        
        // A. Create File
        const createRes = await engine.executeAction({
            type: 'create_file',
            payload: { path: 'test_file.txt', content: 'hello actions' }
        });
        assert.strictEqual(createRes.success, true);
        const filePath = path.join(TEMP_WORKSPACE, 'test_file.txt');
        assert.ok(fs.existsSync(filePath));
        assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), 'hello actions');

        // B. Edit File
        const editRes = await engine.executeAction({
            type: 'edit_file',
            payload: { path: 'test_file.txt', content: 'updated content' }
        });
        assert.strictEqual(editRes.success, true);
        assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), 'updated content');

        // C. Rename File
        const renameRes = await engine.executeAction({
            type: 'rename_file',
            payload: { path: 'test_file.txt', newPath: 'renamed_file.txt' }
        });
        assert.strictEqual(renameRes.success, true);
        const newFilePath = path.join(TEMP_WORKSPACE, 'renamed_file.txt');
        assert.ok(!fs.existsSync(filePath));
        assert.ok(fs.existsSync(newFilePath));

        // D. Move File
        const moveRes = await engine.executeAction({
            type: 'move_file',
            payload: { from: 'renamed_file.txt', to: 'subfolder/moved_file.txt' }
        });
        assert.strictEqual(moveRes.success, true);
        const movedFilePath = path.join(TEMP_WORKSPACE, 'subfolder', 'moved_file.txt');
        assert.ok(!fs.existsSync(newFilePath));
        assert.ok(fs.existsSync(movedFilePath));

        // E. Delete File
        const deleteRes = await engine.executeAction({
            type: 'delete_file',
            payload: { path: 'subfolder/moved_file.txt' }
        });
        assert.strictEqual(deleteRes.success, true);
        assert.ok(!fs.existsSync(movedFilePath));
    });

    // ─── 2. Batch Execution & Rollback ───────────────────────────────────────
    test('should execute batch transaction successfully', async () => {
        const engine = new ActionEngine(TEMP_WORKSPACE);

        const tx = await engine.executeBatch([
            { type: 'create_file', payload: { path: 'f1.txt', content: 'content 1' } },
            { type: 'create_file', payload: { path: 'f2.txt', content: 'content 2' } }
        ]);

        assert.strictEqual(tx.success, true);
        assert.strictEqual(tx.rolledBack, false);
        assert.ok(fs.existsSync(path.join(TEMP_WORKSPACE, 'f1.txt')));
        assert.ok(fs.existsSync(path.join(TEMP_WORKSPACE, 'f2.txt')));
    });

    test('should rollback created and edited files on batch execution failure', async () => {
        const engine = new ActionEngine(TEMP_WORKSPACE);

        // Orijinal dosya oluşturalım
        const originalFile = path.join(TEMP_WORKSPACE, 'orig.txt');
        fs.writeFileSync(originalFile, 'original content', 'utf-8');

        const tx = await engine.executeBatch([
            // 1. Dosyayı düzenle
            { type: 'edit_file', payload: { path: 'orig.txt', content: 'modified content' } },
            // 2. Yeni dosya oluştur
            { type: 'create_file', payload: { path: 'new_temp.txt', content: 'temporary' } },
            // 3. Geçersiz veya bilerek başarısız olacak eylem (var olmayan dosyaya patch)
            { type: 'apply_patch', payload: { path: 'missing.txt', patch: 'diff' } }
        ]);

        // Transaction başarısız olmalı ve rollback edilmeli
        assert.strictEqual(tx.success, false);
        assert.strictEqual(tx.rolledBack, true);

        // original file must have original content restored
        assert.strictEqual(fs.readFileSync(originalFile, 'utf-8'), 'original content');

        // new_temp.txt must not exist (deleted by rollback)
        assert.ok(!fs.existsSync(path.join(TEMP_WORKSPACE, 'new_temp.txt')));
    });

    // ─── 3. Path Traversal & Security Validation ─────────────────────────────
    test('should reject actions attempting path traversal outside workspace', async () => {
        const engine = new ActionEngine(TEMP_WORKSPACE);

        // Ajanın workspace dışına çıkma teşebbüsü
        const badPath = '../traversal_test.txt';
        const res = await engine.executeAction({
            type: 'create_file',
            payload: { path: badPath, content: 'hack' }
        });

        assert.strictEqual(res.success, false);
        // assert check error response or rollback error includes traverse block message
        assert.ok(!fs.existsSync(path.join(TEMP_WORKSPACE, badPath)));
    });

    // ─── 4. Apply Patch Tests ────────────────────────────────────────────────
    test('should apply SEARCH/REPLACE block patches', async () => {
        const engine = new ActionEngine(TEMP_WORKSPACE);
        const filePath = path.join(TEMP_WORKSPACE, 'patch_test.txt');
        fs.writeFileSync(filePath, 'line 1\nline 2\nline 3\n', 'utf-8');

        const patch = `
<<<<<<< SEARCH
line 2
=======
line 2 modified
>>>>>>>
`;

        const res = await engine.executeAction({
            type: 'apply_patch',
            payload: { path: 'patch_test.txt', patch }
        });

        assert.strictEqual(res.success, true);
        assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), 'line 1\nline 2 modified\nline 3\n');
    });

    // ─── 5. EventBus Integration ─────────────────────────────────────────────
    test('should emit event notifications on transaction started/completed', async () => {
        const engine = new ActionEngine(TEMP_WORKSPACE);
        const eventBus = EventBus.getInstance();
        const events: string[] = [];

        const unsub = [
            eventBus.on('TransactionStarted', () => events.push('TxStarted')),
            eventBus.on('ActionStarted', () => events.push('ActStarted')),
            eventBus.on('ActionCompleted', () => events.push('ActCompleted')),
            eventBus.on('TransactionCompleted', () => events.push('TxCompleted'))
        ];

        await engine.executeAction({
            type: 'create_file',
            payload: { path: 'event_test.txt', content: 'test' }
        });

        unsub.forEach(fn => fn());

        assert.ok(events.includes('TxStarted'));
        assert.ok(events.includes('ActStarted'));
        assert.ok(events.includes('ActCompleted'));
        assert.ok(events.includes('TxCompleted'));
    });
});
