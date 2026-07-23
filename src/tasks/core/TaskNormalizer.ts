import { RawTask, NormalizedTask, TaskSourceType } from '../shared/taskTypes';
import { TaskClassifier } from './TaskClassifier';

export class TaskNormalizer {
    private readonly classifier = new TaskClassifier();

    /**
     * Ham (Raw) görev yapısını NormalizedTask modeline dönüştürür.
     */
    public normalize(raw: RawTask, sourceType: TaskSourceType): NormalizedTask {
        const category = this.classifier.classify(raw);
        
        // Başlığı ID olarak kullanmak üzere temizleyelim
        const sanitizedTitle = raw.title
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        
        const id = sanitizedTitle || `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        return {
            id,
            title: raw.title,
            description: raw.description || '',
            sourceType,
            priority: 'medium', // Varsayılan öncelik derecesi, sonradan TaskPriority ile hesaplanır
            status: 'pending',
            dependencies: raw.dependencies || [],
            category,
            metadata: {
                filePath: raw.filePath,
                line: raw.line,
                labels: raw.labels
            }
        };
    }
}
