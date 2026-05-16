import { Task, TaskPriority, TaskStatus } from '../types';
import { IAIProvider } from '../../providers/interfaces/IAIProvider';
import { taskPlanOutputSchema } from '../../schemas';

export interface TaskPlanDTO {
    title: string;
    description: string;
    type?: import('../types').TaskType;
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

const DEFAULT_PROJECT_ID = 'default-project';
const DEFAULT_STATUS: TaskStatus = 'pending';

export function normalizePlannerInput(rawInput: string): string[] {
    return rawInput
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => line.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean);
}

export function buildDeterministicPlan(rawInput: string): TaskPlanDTO[] {
    const items = normalizePlannerInput(rawInput);

    if (items.length === 0) {
        return createFallbackPlan('Boş girdi alındı.');
    }

    const scopedItems = items.length === 1
        ? splitSingleGoalIntoTasks(items[0])
        : items;

    return scopedItems.map((item, index) => ({
        title: buildTaskTitle(item, index),
        description: buildTaskDescription(item, index, scopedItems.length),
        type: inferTaskType(item),
        priority: inferPriority(item, index),
        dependencies: index === 0 ? [] : [index - 1],
        expectedOutput: buildExpectedOutput(item, index)
    }));
}

export function mapTaskPlanToTasks(
    planData: TaskPlanDTO[],
    projectId: string,
    now: number
): Task[] {
    return planData.map((dto, index) => ({
        id: `task_${now}_${index}`,
        projectId,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        order: index,
        priority: dto.priority,
        expectedOutput: dto.expectedOutput,
        dependencies: dto.dependencies.map(dependencyIndex => `task_${now}_${dependencyIndex}`),
        status: DEFAULT_STATUS,
        createdAt: now,
        updatedAt: now
    }));
}

export function createFallbackPlan(reason: string): TaskPlanDTO[] {
    return [
        {
            title: 'Gereksinimleri Netleştir',
            description: `Sistem güvenli fallback modunda çalışıyor. İlk olarak hedefi netleştir: ${reason}`,
            type: 'documentation',
            priority: 'high',
            dependencies: [],
            expectedOutput: 'Netleştirilmiş kapsam ve yapılacaklar listesi'
        },
        {
            title: 'İlk Uygulama İskeletini Hazırla',
            description: 'Ana klasörleri, temel dosyaları ve ilk geliştirme adımlarını tanımla.',
            type: 'code_generation',
            priority: 'medium',
            dependencies: [0],
            expectedOutput: 'Çalışan temel proje iskeleti'
        }
    ];
}

export class TaskPlanner {
    private readonly aiProvider?: IAIProvider;
    private readonly now: () => number;

    constructor(options: PlannerOptions = {}) {
        this.aiProvider = options.aiProvider;
        this.now = options.now ?? (() => Date.now());
    }

    public async planTasks(rawInput: string, projectId: string = DEFAULT_PROJECT_ID): Promise<Task[]> {
        if (!rawInput.trim()) {
            return this.createTasksFromPlan(createFallbackPlan('Kullanıcı girdisi boş.'), projectId);
        }

        try {
            const planData = this.aiProvider
                ? await this.generatePlanWithAI({ rawInput, projectId })
                : buildDeterministicPlan(rawInput);

            if (planData.length === 0) {
                return this.createTasksFromPlan(createFallbackPlan('Plan çıktısı boş döndü.'), projectId);
            }

            return this.createTasksFromPlan(planData, projectId);
        } catch (error) {
            console.error('TaskPlanner error:', error);
            return this.createTasksFromPlan(
                createFallbackPlan('AI planı üretilemedi, yerel fallback kullanıldı.'),
                projectId
            );
        }
    }

    private async generatePlanWithAI(input: PlannerInput): Promise<TaskPlanDTO[]> {
        if (!this.aiProvider) {
            return buildDeterministicPlan(input.rawInput);
        }

        const systemPrompt = [
            'Sen deneyimli bir yazılım planlayıcısısın.',
            'Verilen hedefi küçük, test edilebilir ve sıralı alt görevlere böl.',
            'Görevlerin türünü (code_generation, refactor, bug_fix, test_generation, documentation, code_review) tahmin et.',
            'Sadece JSON array döndür.',
            'Format: [{ title, description, type, priority, dependencies, expectedOutput }]'
        ].join(' ');

        return this.aiProvider.generateJSON<TaskPlanDTO[]>({
            prompt: input.rawInput,
            systemPrompt,
            schemaHint: '[{ title, description, type, priority, dependencies, expectedOutput }]',
            schema: taskPlanOutputSchema,
            schemaName: 'TaskPlanOutput'
        });
    }

    private createTasksFromPlan(planData: TaskPlanDTO[], projectId: string): Task[] {
        return mapTaskPlanToTasks(planData, projectId, this.now());
    }
}

function splitSingleGoalIntoTasks(goal: string): string[] {
    return [
        `${goal} için gereksinimleri çıkar`,
        `${goal} için uygulama planını oluştur`,
        `${goal} için ilk implementasyon adımını hazırla`
    ];
}

function buildTaskTitle(item: string, index: number): string {
    const normalized = item.charAt(0).toUpperCase() + item.slice(1);

    if (normalized.length <= 72) {
        return normalized;
    }

    return `${index + 1}. görev`;
}

function buildTaskDescription(item: string, index: number, total: number): string {
    const previousStep = index === 0 ? 'Bağımsız başlangıç adımı.' : `Önceki ${index}. görevin çıktısına dayanır.`;
    return `${item} adımını uygulanabilir hale getir. ${previousStep} Toplam plan adımı: ${total}.`;
}

function buildExpectedOutput(item: string, index: number): string {
    if (index === 0) {
        return `${item} için net kapsam ve başlangıç çıktısı`;
    }

    return `${item} adımı için gözlemlenebilir çıktı veya teslim edilebilir parça`;
}

function inferTaskType(item: string): import('../types').TaskType {
    const value = item.toLowerCase();
    
    if (value.includes('bug') || value.includes('fix') || value.includes('çöz') || value.includes('hata')) {
        return 'bug_fix';
    }
    if (value.includes('test') || value.includes('spec')) {
        return 'test_generation';
    }
    if (value.includes('refactor') || value.includes('iyileştir') || value.includes('düzenle')) {
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
