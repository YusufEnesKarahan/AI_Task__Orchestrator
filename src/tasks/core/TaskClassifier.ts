import { RawTask, TaskCategoryType } from '../shared/taskTypes';

export class TaskClassifier {
    /**
     * Görevin kategorisini (bug, feature, refactor, docs) tahmin eder.
     */
    public classify(task: RawTask): TaskCategoryType {
        if (task.type) {
            const t = task.type.toLowerCase();
            if (t === 'bug' || t === 'fix') return 'bug';
            if (t === 'feature' || t === 'feat') return 'feature';
            if (t === 'refactor') return 'refactor';
            if (t === 'docs' || t === 'documentation') return 'docs';
        }

        const text = `${task.title} ${task.description || ''} ${(task.labels || []).join(' ')}`.toLowerCase();

        if (text.includes('bug') || text.includes('fix') || text.includes('error') || text.includes('issue') || text.includes('crash')) {
            return 'bug';
        }
        if (text.includes('refactor') || text.includes('cleanup') || text.includes('clean') || text.includes('reorganize')) {
            return 'refactor';
        }
        if (text.includes('document') || text.includes('readme') || text.includes('docs') || text.includes('guide') || text.includes('comment')) {
            return 'docs';
        }
        if (text.includes('feature') || text.includes('add') || text.includes('create') || text.includes('implement')) {
            return 'feature';
        }

        return 'unknown';
    }
}
