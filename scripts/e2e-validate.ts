/**
 * AIOS v1 — End-to-End Validation Script
 *
 * Gerçek bir görev (task) oluşturur ve tüm AIOS zincirini
 * uçtan uca çalıştırarak doğrular.
 */
import * as path from 'path';
import * as fs from 'fs';

import { AIOSApplication } from '../src/runtime/AIOSApplication';
import { EventBus } from '../src/shared/events/EventBus';
import { TaskEngine } from '../src/tasks/TaskEngine';
import { WorkflowEngine } from '../src/workflow/WorkflowEngine';
import { ReasoningEngine } from '../src/reasoning/ReasoningEngine';
import { ExecutionEngine } from '../src/execution/ExecutionEngine';
import { ActionEngine } from '../src/actions/ActionEngine';
import { ReviewEngine } from '../src/review/ReviewEngine';
import { GitEngine } from '../src/git/GitEngine';
import { MCPClient } from '../src/mcp/MCPClient';
import { SystemEngine } from '../src/system/SystemEngine';

const WORKSPACE = path.resolve(__dirname, '..');
const RESULTS: { phase: string; status: string; durationMs: number; detail: string }[] = [];

function logPhase(phase: string, status: string, durationMs: number, detail: string) {
    const icon = status === 'OK' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
    console.log(`${icon} [${phase}] ${status} (${durationMs}ms) — ${detail}`);
    RESULTS.push({ phase, status, durationMs, detail });
}

async function runPhase(name: string, fn: () => Promise<string>): Promise<void> {
    const start = Date.now();
    try {
        const detail = await fn();
        logPhase(name, 'OK', Date.now() - start, detail);
    } catch (err: any) {
        logPhase(name, 'FAIL', Date.now() - start, err.message || String(err));
    }
}

async function main() {
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('   AIOS v1 — End-to-End Validation');
    console.log('══════════════════════════════════════════════════════════\n');

    const totalStart = Date.now();

    // ── 1. Runtime Bootstrap ────────────────────────────────────────
    await runPhase('1. Runtime Bootstrap', async () => {
        const app = AIOSApplication.create(WORKSPACE);
        const ok = await app.start();
        if (!ok) throw new Error('Runtime başlatılamadı');
        const status = app.status();
        const containerCount = app.getContainer().registeredCount;
        await app.stop();
        return `status=${status}, container=${containerCount} services`;
    });

    // ── 2. EventBus ─────────────────────────────────────────────────
    await runPhase('2. EventBus', async () => {
        const bus = EventBus.getInstance();
        let received = false;
        const unsub = bus.on('E2ETestEvent', () => { received = true; });
        bus.emit('E2ETestEvent', {});
        unsub();
        if (!received) throw new Error('EventBus olayı alınmadı');
        return 'emit/subscribe çalışıyor';
    });

    // ── 3. Task Intelligence ────────────────────────────────────────
    await runPhase('3. Task Intelligence', async () => {
        const taskEngine = new TaskEngine(WORKSPACE);
        const markdown = '- [ ] README dosyasına proje açıklaması ekle @depends(none)';
        const tasks = taskEngine.parse(markdown, 'markdown_todo');
        if (tasks.length === 0) throw new Error('Task parse edilemedi');
        return `parsed=${tasks.length}, priority=${tasks[0].priority}, id=${tasks[0].id}`;
    });

    // ── 4. Reasoning Engine ─────────────────────────────────────────
    await runPhase('4. Reasoning Engine', async () => {
        const reasoning = new ReasoningEngine(WORKSPACE);
        const result = await reasoning.analyze({
            taskDescription: 'README dosyasına proje açıklaması ekle'
        });
        return `intent=${result.intent}, complexity=${result.complexity}, strategy=${result.strategy}, plan.steps=${result.plan.steps.length}`;
    });

    // ── 5. Workflow Engine ──────────────────────────────────────────
    await runPhase('5. Workflow Engine', async () => {
        const workflow = new WorkflowEngine(WORKSPACE);
        // WorkflowRegistry is singleton, check templates
        const { WorkflowRegistry } = require('../src/workflow/core/WorkflowRegistry');
        const registry = WorkflowRegistry.getInstance();
        const templates = registry.getAllTemplates();
        return `templates=${templates.length} registered`;
    });

    // ── 6. Execution Engine ─────────────────────────────────────────
    await runPhase('6. Execution Engine', async () => {
        const execution = new ExecutionEngine(WORKSPACE);
        const result = await execution.executePipeline([
            {
                agentId: 'planner',
                taskDescription: 'README dosyasına proje açıklaması ekle'
            }
        ]);
        return `success=${result.success}, executionId=${result.executionId}`;
    });

    // ── 7. Action Engine ────────────────────────────────────────────
    await runPhase('7. Action Engine', async () => {
        const action = new ActionEngine(WORKSPACE);
        const testFile = path.join('scratch', 'e2e_test_file.txt');
        const result = await action.executeAction({
            type: 'create_file',
            payload: {
                filePath: testFile,
                content: '# AIOS E2E Test\nBu dosya otomatik oluşturuldu.'
            }
        });
        // Cleanup
        const fullPath = path.join(WORKSPACE, testFile);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
        return `action=create_file, success=${result.success}`;
    });

    // ── 8. Review Engine ────────────────────────────────────────────
    await runPhase('8. Review Engine', async () => {
        const review = new ReviewEngine(WORKSPACE);
        const report = await review.review([
            'src/runtime/AIOSApplication.ts'
        ]);
        const totalIssues = report.results.reduce((n: number, r: any) => n + r.issues.length, 0);
        return `score=${report.score}, results=${report.results.length}, issues=${totalIssues}`;
    });

    // ── 9. Git Engine ───────────────────────────────────────────────
    await runPhase('9. Git Engine', async () => {
        const git = new GitEngine(WORKSPACE);
        const opened = await git.openRepository();
        const status = await git.getStatus();
        const diff = await git.analyzeDiff();
        const msg = await git.generateCommitMessage(diff);
        return `opened=${opened}, branch=${status.currentBranch}, changedFiles=${diff.changedFiles}, commitMsg="${msg.substring(0, 60)}"`;
    });

    // ── 10. MCP Client ──────────────────────────────────────────────
    await runPhase('10. MCP Client (Mock)', async () => {
        const mcp = new MCPClient(WORKSPACE);
        await mcp.connect('mock://localhost:8080');
        const tools = await mcp.discoverTools();
        const output = await mcp.executeTool('filesystem_read', { path: 'test.ts' });
        await mcp.disconnect();
        return `tools=${tools.length}, output=${output.substring(0, 50)}...`;
    });

    // ── 11. System Engine ───────────────────────────────────────────
    await runPhase('11. System Engine', async () => {
        const system = new SystemEngine(WORKSPACE);
        const profiler = system.getProfiler();
        profiler.startMeasure('e2e');
        await new Promise(r => setTimeout(r, 10));
        profiler.stopMeasure('e2e');
        const report = system.profile();
        const memory = system.checkMemory();
        const health = await system.checkHealth();
        const benchmark = await system.benchmark('e2e_test');
        return `avg=${report.averageExecutionTime.toFixed(0)}ms, heap=${(memory.heapUsed / 1024 / 1024).toFixed(1)}MB, health=${health.status}, ops=${benchmark.opsPerSec}/s`;
    });

    // ── 12. Recovery Manager ────────────────────────────────────────
    await runPhase('12. Recovery', async () => {
        const system = new SystemEngine(WORKSPACE);
        const recovery = await system.recover('e2e-test');
        return `success=${recovery.success}, restored=${recovery.restoredCount} files`;
    });

    // ── 13. Configuration Validation ────────────────────────────────
    await runPhase('13. Config Validation', async () => {
        const system = new SystemEngine(WORKSPACE);
        const validGood = system.validate({ provider: 'mock', maxIterations: 5 });
        const validBad = system.validate({ provider: 'invalid_provider' });
        return `valid_config=${validGood}, invalid_config=${validBad}`;
    });

    // ── Performance Summary ─────────────────────────────────────────
    const totalDuration = Date.now() - totalStart;
    const passCount = RESULTS.filter(r => r.status === 'OK').length;
    const failCount = RESULTS.filter(r => r.status === 'FAIL').length;

    console.log('\n══════════════════════════════════════════════════════════');
    console.log(`   SONUÇ: ${passCount} başarılı, ${failCount} başarısız — Toplam: ${totalDuration}ms`);
    console.log('══════════════════════════════════════════════════════════\n');

    // Write results JSON
    const resultsDir = path.join(WORKSPACE, '.aios');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
    const resultsPath = path.join(resultsDir, 'e2e-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify({ totalDuration, results: RESULTS }, null, 2), 'utf-8');
    console.log(`Sonuçlar: ${resultsPath}`);

    if (failCount > 0) process.exit(1);
}

main().catch(err => {
    console.error('E2E hata:', err);
    process.exit(1);
});
