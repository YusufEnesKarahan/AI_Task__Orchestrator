import * as fs from 'fs';
import * as path from 'path';
import { EventBus } from '../shared/events/EventBus';
import { TaskParser } from './core/TaskParser';
import { TaskNormalizer } from './core/TaskNormalizer';
import { TaskClassifier } from './core/TaskClassifier';
import { TaskPriority } from './core/TaskPriority';
import { TaskDependencyResolver } from './core/TaskDependencyResolver';
import { RawTask, NormalizedTask, TaskSourceType, TaskPriorityType, TaskCategoryType, TaskHistoryLog } from './shared/taskTypes';

export class TaskEngine {
    private readonly parser = new TaskParser();
    private readonly normalizer = new TaskNormalizer();
    private readonly classifier = new TaskClassifier();
    private readonly priorityTracker = new TaskPriority();
    private readonly dependencyResolver = new TaskDependencyResolver();
    private readonly eventBus = EventBus.getInstance();

    private readonly tasksDir: string;
    private readonly historyPath: string;

    constructor(private readonly workspaceRoot: string) {
        this.tasksDir = path.join(workspaceRoot, '.aios', 'tasks');
        this.historyPath = path.join(this.tasksDir, 'history.json');
        this.ensureDirExists();
    }

    private ensureDirExists() {
        if (!fs.existsSync(this.tasksDir)) {
            fs.mkdirSync(this.tasksDir, { recursive: true });
        }
    }

    /**
     * Ham metin girdisini ve biçimi (format) kullanarak normalize edilmiş görev listesine dönüştürür.
     */
    public parse(source: string, format: TaskSourceType, filePath?: string): NormalizedTask[] {
        let rawTasks: RawTask[] = [];

        switch (format) {
            case 'markdown_todo':
                rawTasks = this.parser.parseMarkdown(source);
                break;
            case 'code_comment':
                rawTasks = this.parser.parseCodeComments(filePath || 'unknown_file.ts', source);
                break;
            case 'github_issue':
                const rawIssue = this.parser.parseGitHubIssue(source);
                rawTasks = [rawIssue];
                break;
            case 'json':
                rawTasks = this.parser.parseJsonList(source);
                break;
            case 'aios':
                rawTasks = this.parser.parseJsonList(source); // Aios format uses standard JSON list format
                break;
            default:
                throw new Error(`Bilinmeyen görev kaynağı formatı: ${format}`);
        }

        const normalized = rawTasks.map(raw => {
            const task = this.normalizer.normalize(raw, format);
            task.priority = this.prioritize(task);
            this.eventBus.emit('TaskPrioritized', { taskId: task.id, priority: task.priority });
            return task;
        });

        this.eventBus.emit('TaskParsed', { source: format, count: normalized.length });
        
        // Geçmişe kaydet
        this.saveToHistory(normalized);

        return normalized;
    }

    public classify(raw: RawTask): TaskCategoryType {
        return this.classifier.classify(raw);
    }

    public normalize(raw: RawTask, format: TaskSourceType): NormalizedTask {
        const task = this.normalizer.normalize(raw, format);
        task.priority = this.prioritize(task);
        return task;
    }

    public prioritize(task: NormalizedTask): TaskPriorityType {
        return this.priorityTracker.prioritize(task);
    }

    public resolveDependencies(tasks: NormalizedTask[]): NormalizedTask[] {
        const sorted = this.dependencyResolver.resolve(tasks);
        this.eventBus.emit('TaskDependenciesResolved', { sortedIds: sorted.map(t => t.id) });
        return sorted;
    }

    /**
     * Kayıtlı tüm görev geçmişini döndürür.
     */
    public getHistory(): TaskHistoryLog[] {
        if (!fs.existsSync(this.historyPath)) return [];
        try {
            const data = fs.readFileSync(this.historyPath, 'utf-8');
            return JSON.parse(data) as TaskHistoryLog[];
        } catch {
            return [];
        }
    }

    private saveToHistory(tasks: NormalizedTask[]) {
        if (tasks.length === 0) return;

        const log: TaskHistoryLog = {
            parsedAt: Date.now(),
            tasksCount: tasks.length,
            tasks
        };

        let history = this.getHistory();
        history.push(log);

        if (history.length > 100) {
            history.shift();
        }

        fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2), 'utf-8');
    }
}
