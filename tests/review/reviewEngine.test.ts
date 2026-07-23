import { describe, test, before, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import { ReviewEngine } from '../../src/review/ReviewEngine';
import { EventBus } from '../../src/shared/events/EventBus';

const TEMP_WORKSPACE = path.join(__dirname, '..', '..', 'scratch', 'temp_workspace_review_test');

describe('Review Engine Tests', () => {

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
                if (fs.statSync(fullPath).isDirectory()) {
                    cleanDir(fullPath);
                    fs.rmdirSync(fullPath);
                } else {
                    fs.unlinkSync(fullPath);
                }
            }
        };
        cleanDir(TEMP_WORKSPACE);
    });

    // ─── 1. Architecture Layer Violations ────────────────────────────────────
    test('should flag architecture layer violations if core module imports upper layer', async () => {
        const engine = new ReviewEngine(TEMP_WORKSPACE);
        
        // Core layer file importing actions upper layer
        const coreDir = path.join(TEMP_WORKSPACE, 'src', 'core');
        fs.mkdirSync(coreDir, { recursive: true });
        const coreFile = path.join(coreDir, 'userService.ts');
        fs.writeFileSync(coreFile, `
import { User } from '../domain/User';
import { ActionEngine } from '../../actions/ActionEngine'; // Mimari ihlal!
export class UserService {}
        `, 'utf-8');

        const report = await engine.reviewBatch(['src/core/userService.ts'], ['ArchitectureReview']);

        assert.strictEqual(report.passed, false);
        assert.ok(report.score < 100);
        assert.ok(report.results[0].issues[0].includes('Mimari İhlal'));
    });

    // ─── 2. Code Quality Review ──────────────────────────────────────────────
    test('should flag code quality issues for deeply nested blocks', async () => {
        const engine = new ReviewEngine(TEMP_WORKSPACE);
        const codeFile = path.join(TEMP_WORKSPACE, 'complex.ts');
        fs.writeFileSync(codeFile, `
export function complex() {
    if (a) {
        if (b) {
            if (c) {
                if (d) {
                    if (e) {
                        console.log('too deep!');
                    }
                }
            }
        }
    }
}
        `, 'utf-8');

        const report = await engine.reviewBatch(['complex.ts'], ['CodeQualityReview']);

        assert.strictEqual(report.passed, false);
        assert.ok(report.results[0].issues[0].includes('Aşırı karmaşıklık'));
    });

    // ─── 3. Test Coverage Review ─────────────────────────────────────────────
    test('should flag test coverage warnings if no test file is found', async () => {
        const engine = new ReviewEngine(TEMP_WORKSPACE);
        const codeFile = path.join(TEMP_WORKSPACE, 'service.ts');
        fs.writeFileSync(codeFile, 'export class Service {}', 'utf-8');

        const report = await engine.reviewBatch(['service.ts'], ['TestCoverageReview']);

        assert.strictEqual(report.passed, false);
        assert.ok(report.results[0].issues[0].includes('Test Eksikliği'));
    });

    // ─── 4. Security Vulnerability Checks ────────────────────────────────────
    test('should flag security review leaks for hardcoded api keys or eval usage', async () => {
        const engine = new ReviewEngine(TEMP_WORKSPACE);
        const secFile = path.join(TEMP_WORKSPACE, 'securityRisk.ts');
        fs.writeFileSync(secFile, `
const api_key = "abc123xyz_key_secret"; // leak
eval("console.log('unsafe')"); // eval
        `, 'utf-8');

        const report = await engine.reviewBatch(['securityRisk.ts'], ['SecurityReview']);

        assert.strictEqual(report.passed, false);
        assert.ok(report.results[0].issues.length >= 2);
    });

    // ─── 5. Performance Warning Checks ───────────────────────────────────────
    test('should warn on synchronous file system calls', async () => {
        const engine = new ReviewEngine(TEMP_WORKSPACE);
        const perfFile = path.join(TEMP_WORKSPACE, 'perfIssues.ts');
        fs.writeFileSync(perfFile, `
import * as fs from 'fs';
export function read() {
    return fs.readFileSync('data.txt', 'utf-8'); // sync call
}
        `, 'utf-8');

        const report = await engine.reviewBatch(['perfIssues.ts'], ['PerformanceReview']);

        // passed should be true because warnings don't fail, but warnings list has the sync message
        assert.strictEqual(report.passed, true);
        assert.ok(report.results[0].warnings[0].includes('senkron dosya sistemi'));
        assert.ok(report.results[0].score < 100);
    });

    // ─── 6. EventBus Integration ─────────────────────────────────────────────
    test('should dispatch EventBus events on review started and completed', async () => {
        const engine = new ReviewEngine(TEMP_WORKSPACE);
        const eventBus = EventBus.getInstance();
        const events: string[] = [];

        const unsub = [
            eventBus.on('CodeReviewStarted', () => events.push('RevStarted')),
            eventBus.on('CodeReviewStepCompleted', () => events.push('StepCompleted')),
            eventBus.on('CodeReviewCompleted', () => events.push('RevCompleted'))
        ];

        const codeFile = path.join(TEMP_WORKSPACE, 'clean.ts');
        fs.writeFileSync(codeFile, 'export class Clean {}', 'utf-8');
        // also add a test to keep coverage reviewer happy
        const testFile = path.join(TEMP_WORKSPACE, 'clean.test.ts');
        fs.writeFileSync(testFile, 'describe()', 'utf-8');

        const report = await engine.review(['clean.ts', 'clean.test.ts']);
        unsub.forEach(fn => fn());

        assert.strictEqual(report.passed, true);
        assert.strictEqual(report.score, 100); // completely clean file
        assert.ok(events.includes('RevStarted'));
        assert.ok(events.includes('StepCompleted'));
        assert.ok(events.includes('RevCompleted'));
    });
});
