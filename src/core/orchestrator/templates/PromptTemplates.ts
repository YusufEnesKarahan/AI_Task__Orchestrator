import { Task, TaskType } from '../../types';

export interface PromptBuildContext {
    task: Task;
    contextCode?: string;
}

export interface PromptTemplateDefinition {
    id: string;
    name: string;
    systemPrompt: string;
    buildUserPrompt: (context: PromptBuildContext) => string;
}

export const PROMPT_TEMPLATES: Record<TaskType, PromptTemplateDefinition> = {
    code_generation: createTemplate({
        id: 'template_code_generation',
        name: 'Code Generation',
        systemPrompt:
            'You are a senior software engineer. Produce implementation-ready code with clear structure and safe defaults.',
        contextIntro: 'You are implementing a new feature or file in an existing software project.',
        constraints: [
            'Write production-ready code.',
            'Prefer small, readable units and safe defaults.',
            'Preserve existing architecture and avoid unrelated rewrites.',
            'Return the implementation in a practical form for a developer to apply.'
        ],
        defaultExpectedOutput: 'Complete implementation for the requested task.'
    }),
    refactor: createTemplate({
        id: 'template_refactor',
        name: 'Refactor',
        systemPrompt:
            'You are a senior software architect. Improve the internal quality of the code without changing external behavior.',
        contextIntro: 'You are improving existing code for maintainability, readability, and structure.',
        constraints: [
            'Do not change external behavior or public contracts unless explicitly requested.',
            'Reduce complexity and improve naming where needed.',
            'Preserve compatibility with the current codebase.',
            'Call out any risky assumptions briefly inside the response.'
        ],
        defaultExpectedOutput: 'Refactored code with behavior preserved.'
    }),
    bug_fix: createTemplate({
        id: 'template_bug_fix',
        name: 'Bug Fix',
        systemPrompt: 'You are an expert debugger. Find the likely root cause and produce a focused, reliable fix.',
        contextIntro: 'The task is to diagnose and fix a bug with minimal side effects.',
        constraints: [
            'Fix the described bug only; avoid unnecessary refactors.',
            'Explain the likely root cause briefly.',
            'Protect against regressions and edge cases.',
            'Keep the change focused and easy to verify.'
        ],
        defaultExpectedOutput: 'A focused bug fix and a short explanation of the root cause.'
    }),
    test_generation: createTemplate({
        id: 'template_test_generation',
        name: 'Test Generation',
        systemPrompt:
            'You are a QA-focused engineer. Write reliable tests that cover expected behavior, edge cases, and failures.',
        contextIntro: 'The task is to create or improve automated tests for the described behavior.',
        constraints: [
            'Use the project’s likely testing conventions where possible.',
            'Include positive, negative, and edge-case coverage.',
            'Mock external dependencies only when necessary.',
            'Keep tests readable and maintainable.'
        ],
        defaultExpectedOutput: 'A complete test suite or test additions for the task.'
    }),
    documentation: createTemplate({
        id: 'template_documentation',
        name: 'Documentation',
        systemPrompt:
            'You are a technical writer with engineering context. Produce clear and accurate documentation for developers.',
        contextIntro: 'The task is to document a feature, module, workflow, or API clearly.',
        constraints: [
            'Use concise, developer-friendly language.',
            'Keep the structure easy to scan.',
            'Include examples when they improve clarity.',
            'Avoid marketing tone; stay practical and technical.'
        ],
        defaultExpectedOutput: 'Documentation content ready to add to the codebase.'
    }),
    code_review: createTemplate({
        id: 'template_code_review',
        name: 'Code Review',
        systemPrompt:
            'You are a careful code reviewer. Evaluate correctness, safety, maintainability, and test coverage.',
        contextIntro: 'The task is to review code or a proposed change and provide actionable feedback.',
        constraints: [
            'Prioritize correctness, security, regressions, and missing tests.',
            'Keep feedback concrete and actionable.',
            'Distinguish high-risk issues from minor improvements.',
            'Do not rewrite the code unless explicitly requested.'
        ],
        defaultExpectedOutput: 'A concise review with findings, risks, and recommended next actions.'
    })
};

function createTemplate(input: {
    id: string;
    name: string;
    systemPrompt: string;
    contextIntro: string;
    constraints: string[];
    defaultExpectedOutput: string;
}): PromptTemplateDefinition {
    return {
        id: input.id,
        name: input.name,
        systemPrompt: input.systemPrompt,
        buildUserPrompt: ({ task, contextCode }) =>
            buildStructuredPrompt({
                context: buildContextSection(task, input.contextIntro, contextCode),
                objective: buildObjectiveSection(task),
                constraints: input.constraints,
                expectedOutput: task.expectedOutput || input.defaultExpectedOutput
            })
    };
}

function buildStructuredPrompt(input: {
    context: string;
    objective: string;
    constraints: string[];
    expectedOutput: string;
}): string {
    const constraints = input.constraints.map((item) => `- ${item}`).join('\n');

    return [
        '# CONTEXT',
        input.context,
        '',
        '# OBJECTIVE',
        input.objective,
        '',
        '# CONSTRAINTS',
        constraints,
        '',
        '# EXPECTED OUTPUT',
        input.expectedOutput
    ]
        .join('\n')
        .trim();
}

function buildContextSection(task: Task, intro: string, contextCode?: string): string {
    const lines = [
        intro,
        `Project ID: ${task.projectId}`,
        `Task title: ${task.title}`,
        `Task priority: ${task.priority || 'medium'}`,
        `Dependencies: ${task.dependencies && task.dependencies.length > 0 ? task.dependencies.join(', ') : 'None'}`
    ];

    if (contextCode && contextCode.trim()) {
        lines.push('', 'Relevant code or context:', '```', contextCode.trim(), '```');
    } else {
        lines.push('', 'Relevant code or context: No additional code context was provided.');
    }

    return lines.join('\n');
}

function buildObjectiveSection(task: Task): string {
    return [task.title, task.description].filter(Boolean).join('\n');
}
