import { Task, TaskPriority, TaskStatus, TaskType } from '../types';
import { IAIProvider } from '../../providers/interfaces/IAIProvider';
import { taskPlanOutputSchema } from '../../schemas';

export interface TaskPlanDTO {
    title: string;
    description: string;
    type?: TaskType;
    priority: TaskPriority;
    dependencies: number[];
    expectedOutput: string;
}

export interface PlannerOptions {
    aiProvider?: IAIProvider;
    now?: () => number;
}

export interface PlannerInput {
    projectId: string;
    rawInput: string;
}

export interface PlanningDiagnostics {
    usedAI: boolean;
    fallbackReason?: string;
}

const DEFAULT_PROJECT_ID = 'default-project';
const DEFAULT_STATUS: TaskStatus = 'pending';
const TASK_TYPES: TaskType[] = [
    'code_generation',
    'refactor',
    'bug_fix',
    'test_generation',
    'documentation',
    'code_review'
];

export function normalizePlannerInput(rawInput: string): string[] {
    return rawInput
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean);
}

export function buildDeterministicPlan(rawInput: string): TaskPlanDTO[] {
    const items = normalizePlannerInput(rawInput);

    if (items.length === 0) {
        return createFallbackPlan('Bos girdi alindi.');
    }

    if (shouldUseSingleTaskPlan(rawInput, items)) {
        return createSingleTaskPlan(items.join(' '));
    }

    const scopedItems = items.length === 1 ? splitSingleGoalIntoTasks(items[0]) : items;

    return scopedItems.map((item, index) => ({
        title: buildTaskTitle(item, index),
        description: buildTaskDescription(item, index, scopedItems.length),
        type: inferTaskType(item),
        priority: inferPriority(item, index),
        dependencies: index === 0 ? [] : [index - 1],
        expectedOutput: buildExpectedOutput(item, index)
    }));
}

export function mapTaskPlanToTasks(planData: TaskPlanDTO[], projectId: string, now: number): Task[] {
    return planData.map((dto, index) => ({
        id: `task_${now}_${index}`,
        projectId,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        order: index,
        priority: dto.priority,
        expectedOutput: dto.expectedOutput,
        dependencies: dto.dependencies.map((dependencyIndex) => `task_${now}_${dependencyIndex}`),
        status: DEFAULT_STATUS,
        createdAt: now,
        updatedAt: now
    }));
}

export function createFallbackPlan(reason: string): TaskPlanDTO[] {
    return [
        {
            title: 'Gereksinimleri Netlestir',
            description: `Sistem guvenli fallback modunda calisiyor. Ilk olarak hedefi netlestir: ${reason}`,
            type: 'documentation',
            priority: 'high',
            dependencies: [],
            expectedOutput: 'Netlestirilmis kapsam ve yapilacaklar listesi'
        },
        {
            title: 'Ilk Uygulama Iskeletini Hazirla',
            description: 'Ana klasorleri, temel dosyalari ve ilk gelistirme adimlarini tanimla.',
            type: 'code_generation',
            priority: 'medium',
            dependencies: [0],
            expectedOutput: 'Calisan temel proje iskeleti'
        }
    ];
}

export class TaskPlanner {
    private readonly aiProvider?: IAIProvider;
    private readonly now: () => number;
    private lastDiagnostics: PlanningDiagnostics = { usedAI: false };

    constructor(options: PlannerOptions = {}) {
        this.aiProvider = options.aiProvider;
        this.now = options.now ?? (() => Date.now());
    }

    public async planTasks(rawInput: string, projectId: string = DEFAULT_PROJECT_ID): Promise<Task[]> {
        this.lastDiagnostics = { usedAI: false };

        if (!rawInput.trim()) {
            this.lastDiagnostics = { usedAI: false, fallbackReason: 'Kullanici girdisi bos.' };
            return this.createTasksFromPlan(createFallbackPlan('Kullanici girdisi bos.'), projectId);
        }

        try {
            const planData = this.aiProvider
                ? await this.generatePlanWithAI({ rawInput, projectId })
                : buildDeterministicPlan(rawInput);
            const resolvedPlanData = shouldUseSingleTaskPlan(rawInput, normalizePlannerInput(rawInput))
                ? createSingleTaskPlan(rawInput)
                : planData;

            if (resolvedPlanData.length === 0) {
                this.lastDiagnostics = { usedAI: false, fallbackReason: 'Plan ciktisi bos dondu.' };
                return this.createTasksFromPlan(createFallbackPlan('Plan ciktisi bos dondu.'), projectId);
            }

            this.lastDiagnostics = { usedAI: !!this.aiProvider };
            return this.createTasksFromPlan(resolvedPlanData, projectId);
        } catch (error) {
            const fallbackReason = this.formatPlanningError(error);
            this.lastDiagnostics = { usedAI: false, fallbackReason };
            console.error('TaskPlanner error:', fallbackReason);
            return this.createTasksFromPlan(
                createFallbackPlan('AI plani uretilemedi, yerel fallback kullanildi.'),
                projectId
            );
        }
    }

    public getLastDiagnostics(): PlanningDiagnostics {
        return this.lastDiagnostics;
    }

    private async generatePlanWithAI(input: PlannerInput): Promise<TaskPlanDTO[]> {
        if (!this.aiProvider) {
            return buildDeterministicPlan(input.rawInput);
        }

        const systemPrompt = [
            'You are a senior software task planner.',
            'Return only valid JSON. Do not wrap it in markdown.',
            'The root value must be a JSON array, not an object.',
            'Each item must contain: title, description, type, priority, dependencies, expectedOutput.',
            'Allowed type values: code_generation, refactor, bug_fix, test_generation, documentation, code_review.',
            'Allowed priority values: high, medium, low.',
            'dependencies must be zero-based numeric indexes of earlier tasks.',
            'If the request is a simple operation, return exactly one task.',
            'Simple operations include git commit/push, README edits, small bug fixes, and single-file edits.',
            'Only return multiple tasks for large features, architecture refactors, broad migrations, or explicit step-by-step requests.'
        ].join(' ');

        const rawResponse = await this.aiProvider.generateText({
            prompt: [
                'Create a concise implementation task plan for this project goal:',
                input.rawInput,
                '',
                'Return JSON array only.'
            ].join('\n'),
            systemPrompt,
            temperature: 0.2,
            maxTokens: 1800
        });

        return parseTaskPlanResponse(rawResponse);
    }

    private createTasksFromPlan(planData: TaskPlanDTO[], projectId: string): Task[] {
        return mapTaskPlanToTasks(planData, projectId, this.now());
    }

    private formatPlanningError(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }

        return String(error);
    }
}

export function parseTaskPlanResponse(rawResponse: string): TaskPlanDTO[] {
    const parsed = parseJsonFromText(rawResponse);
    const normalized = normalizeTaskPlanShape(parsed);
    return taskPlanOutputSchema.parse(normalized);
}

function parseJsonFromText(rawResponse: string): unknown {
    const cleaned = rawResponse
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    const firstArray = cleaned.indexOf('[');
    const firstObject = cleaned.indexOf('{');
    const starts = [firstArray, firstObject].filter((index) => index >= 0);
    const start = starts.length > 0 ? Math.min(...starts) : -1;

    if (start === -1) {
        throw new Error('AI task plan response did not contain JSON.');
    }

    const candidate = cleaned.slice(start);
    const lastArray = candidate.lastIndexOf(']');
    const lastObject = candidate.lastIndexOf('}');
    const end = Math.max(lastArray, lastObject);

    if (end === -1) {
        throw new Error('AI task plan response contained incomplete JSON.');
    }

    return JSON.parse(candidate.slice(0, end + 1));
}

function normalizeTaskPlanShape(value: unknown): TaskPlanDTO[] {
    const rawItems = Array.isArray(value) ? value : extractTaskArray(value);
    return rawItems.map((item, index) => normalizeTaskPlanItem(item, index));
}

function extractTaskArray(value: unknown): unknown[] {
    if (!value || typeof value !== 'object') {
        throw new Error('AI task plan JSON was not an array or object.');
    }

    const record = value as Record<string, unknown>;
    const candidates = [record.tasks, record.plan, record.items];
    const array = candidates.find(Array.isArray);

    if (!array) {
        throw new Error('AI task plan JSON object did not contain a tasks array.');
    }

    return array;
}

function normalizeTaskPlanItem(value: unknown, index: number): TaskPlanDTO {
    const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    const title = normalizeText(record.title) || `Task ${index + 1}`;
    const description = normalizeText(record.description) || title;
    const typeText = normalizeText(record.type);

    return {
        title,
        description,
        type: isTaskType(typeText) ? typeText : inferTaskType(`${title} ${description}`),
        priority: normalizePriority(record.priority, index),
        dependencies: normalizeDependencies(record.dependencies),
        expectedOutput: normalizeText(record.expectedOutput) || normalizeText(record.output) || `Completed ${title}`
    };
}

function normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizePriority(value: unknown, index: number): TaskPriority {
    const priority = normalizeText(value).toLowerCase();
    if (priority === 'high' || priority === 'medium' || priority === 'low') {
        return priority;
    }

    return index === 0 ? 'high' : 'medium';
}

function normalizeDependencies(value: unknown): number[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => {
            if (typeof item === 'number' && Number.isInteger(item) && item >= 0) {
                return item;
            }

            const match = String(item).match(/\d+/);
            return match ? Number(match[0]) : undefined;
        })
        .filter((item): item is number => item !== undefined);
}

function isTaskType(value: string): value is TaskType {
    return TASK_TYPES.includes(value as TaskType);
}

export function shouldUseSingleTaskPlan(rawInput: string, items: string[] = normalizePlannerInput(rawInput)): boolean {
    const value = rawInput.toLowerCase();

    if (items.length > 1 || wantsStepByStepPlan(value)) {
        return false;
    }

    return SIMPLE_OPERATION_PATTERNS.some((pattern) => pattern.test(value));
}

function createSingleTaskPlan(input: string): TaskPlanDTO[] {
    const item = input.trim();

    return [
        {
            title: buildTaskTitle(item, 0),
            description: `${item} isteğini tek, odaklı bir operasyon olarak uygula. Gereksiz alt görevlere bölme; ön kontrolleri, uygulamayı ve doğrulamayı aynı prompt içinde ele al.`,
            type: inferTaskType(item),
            priority: inferPriority(item, 0),
            dependencies: [],
            expectedOutput: `${item} için tamamlanmış değişiklik, doğrulama notu ve kısa özet`
        }
    ];
}

function wantsStepByStepPlan(value: string): boolean {
    return /\b(step by step|adim adim|adım adım|parcala|parçala|bol|böl|subtask|alt gorev|alt görev)\b/.test(value);
}

const SIMPLE_OPERATION_PATTERNS = [
    /\b(git|github|repo|repository)\b.*\b(commit|push|stage)\b/,
    /\b(commit|push|stage)\b.*\b(git|github|repo|repository)\b/,
    /\breadme\b.*\b(update|fix|duzelt|düzelt|edit|guncelle|güncelle)\b/,
    /\b(update|fix|duzelt|düzelt|edit|guncelle|güncelle)\b.*\breadme\b/,
    /\b(small|minor|quick|kucuk|küçük|basit)\b.*\b(bug|fix|hata|duzelt|düzelt)\b/,
    /\b(single file|tek dosya)\b/,
    /\btypo|yazim|yazım\b/
];

function splitSingleGoalIntoTasks(goal: string): string[] {
    return [
        `${goal} icin gereksinimleri cikar`,
        `${goal} icin uygulama planini olustur`,
        `${goal} icin ilk implementasyon adimini hazirla`
    ];
}

function buildTaskTitle(item: string, index: number): string {
    const normalized = item.charAt(0).toUpperCase() + item.slice(1);

    if (normalized.length <= 72) {
        return normalized;
    }

    return `${index + 1}. gorev`;
}

function buildTaskDescription(item: string, index: number, total: number): string {
    const previousStep = index === 0 ? 'Bagimsiz baslangic adimi.' : `Onceki ${index}. gorevin ciktisina dayanir.`;
    return `${item} adimini uygulanabilir hale getir. ${previousStep} Toplam plan adimi: ${total}.`;
}

function buildExpectedOutput(item: string, index: number): string {
    if (index === 0) {
        return `${item} icin net kapsam ve baslangic ciktisi`;
    }

    return `${item} adimi icin gozlemlenebilir cikti veya teslim edilebilir parca`;
}

function inferTaskType(item: string): TaskType {
    const value = item.toLowerCase();

    if (value.includes('bug') || value.includes('fix') || value.includes('coz') || value.includes('hata')) {
        return 'bug_fix';
    }
    if (value.includes('test') || value.includes('spec')) {
        return 'test_generation';
    }
    if (value.includes('refactor') || value.includes('iyilestir') || value.includes('duzenle')) {
        return 'refactor';
    }
    if (value.includes('doc') || value.includes('belge') || value.includes('readme')) {
        return 'documentation';
    }
    if (value.includes('review') || value.includes('incele')) {
        return 'code_review';
    }
    return 'code_generation';
}

function inferPriority(item: string, index: number): TaskPriority {
    const value = item.toLowerCase();

    if (
        value.includes('auth') ||
        value.includes('login') ||
        value.includes('security') ||
        value.includes('db') ||
        value.includes('database') ||
        value.includes('schema')
    ) {
        return 'high';
    }

    if (
        value.includes('test') ||
        value.includes('docs') ||
        value.includes('document') ||
        value.includes('style') ||
        value.includes('ui')
    ) {
        return 'medium';
    }

    return index === 0 ? 'high' : 'medium';
}
