export interface RawTask {
    title: string;
    description?: string;
    labels?: string[];
    filePath?: string;
    line?: number;
    type?: string;
    dependencies?: string[];
}

export type TaskSourceType = 'github_issue' | 'markdown_todo' | 'code_comment' | 'json' | 'aios';
export type TaskPriorityType = 'critical' | 'high' | 'medium' | 'low';
export type TaskCategoryType = 'bug' | 'feature' | 'refactor' | 'docs' | 'unknown';

export interface NormalizedTask {
    id: string;
    title: string;
    description: string;
    sourceType: TaskSourceType;
    priority: TaskPriorityType;
    status: 'pending' | 'running' | 'completed' | 'failed';
    dependencies: string[];
    category: TaskCategoryType;
    metadata?: Record<string, any>;
}

export interface TaskHistoryLog {
    parsedAt: number;
    tasksCount: number;
    tasks: NormalizedTask[];
}
