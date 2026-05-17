import test from 'node:test';
import assert from 'node:assert/strict';
import {
    TaskPlanner,
    buildDeterministicPlan,
    parseTaskPlanResponse,
    shouldUseSingleTaskPlan
} from '../src/core/orchestrator/TaskPlanner';
import {
    AIProviderJsonRequest,
    AIProviderTextRequest,
    IAIProvider,
    ProviderHealthStatus
} from '../src/providers/interfaces/IAIProvider';

test('parseTaskPlanResponse accepts object-wrapped model output and normalizes fields', () => {
    const plan = parseTaskPlanResponse(`Here is the plan:
{
  "tasks": [
    {
      "title": "Build login",
      "description": "Create login UI and API",
      "type": "feature",
      "priority": "urgent",
      "dependencies": ["0"],
      "output": "Working login"
    }
  ]
}`);

    assert.equal(plan.length, 1);
    assert.equal(plan[0]?.title, 'Build login');
    assert.equal(plan[0]?.type, 'code_generation');
    assert.equal(plan[0]?.priority, 'high');
    assert.deepEqual(plan[0]?.dependencies, [0]);
    assert.equal(plan[0]?.expectedOutput, 'Working login');
});

test('TaskPlanner uses AI text response when it can be normalized to a valid plan', async () => {
    const planner = new TaskPlanner({
        aiProvider: new TextPlanProvider(
            JSON.stringify([
                {
                    title: 'Create API',
                    description: 'Implement the first API endpoint',
                    priority: 'high',
                    dependencies: [],
                    expectedOutput: 'Endpoint works'
                }
            ])
        ),
        now: () => 123
    });

    const tasks = await planner.planTasks('Create an API', 'project_1');

    assert.equal(planner.getLastDiagnostics().usedAI, true);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.title, 'Create API');
    assert.equal(tasks[0]?.id, 'task_123_0');
});

test('TaskPlanner records fallback reason when provider returns non-JSON text', async () => {
    const planner = new TaskPlanner({
        aiProvider: new TextPlanProvider('not json'),
        now: () => 123
    });

    const tasks = await planner.planTasks('Create an API', 'project_1');
    const diagnostics = planner.getLastDiagnostics();

    assert.equal(diagnostics.usedAI, false);
    assert.match(diagnostics.fallbackReason || '', /did not contain JSON/);
    assert.equal(tasks.length, 2);
    assert.match(tasks[0]?.description || '', /fallback/);
});

test('buildDeterministicPlan keeps simple git commit and push requests as one task', () => {
    const input = 'Proje GitHub reposuna bağlı, güncel değişiklikleri commit edip push et.';
    const plan = buildDeterministicPlan(input);

    assert.equal(shouldUseSingleTaskPlan(input), true);
    assert.equal(plan.length, 1);
    assert.match(plan[0]?.title || '', /GitHub|github|commit/i);
});

test('buildDeterministicPlan allows explicit step-by-step decomposition', () => {
    const input = 'GitHub commit ve push işini adım adım böl.';
    const plan = buildDeterministicPlan(input);

    assert.equal(shouldUseSingleTaskPlan(input), false);
    assert.ok(plan.length > 1);
});

class TextPlanProvider implements IAIProvider {
    public readonly providerName = 'TestProvider';
    public readonly model = 'test-model';

    public constructor(private readonly text: string) {}

    public async generateText(_request: AIProviderTextRequest): Promise<string> {
        return this.text;
    }

    public async generateJSON<T>(_request: AIProviderJsonRequest<T>): Promise<T> {
        throw new Error('generateJSON should not be used by TaskPlanner');
    }

    public async testConnection(): Promise<ProviderHealthStatus> {
        return { ok: true, provider: this.providerName };
    }
}
