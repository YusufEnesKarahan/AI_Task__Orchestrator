import { NormalizedTask, TaskPriorityType } from '../shared/taskTypes';

export class TaskPriority {
    /**
     * Görevin öncelik derecesini (critical, high, medium, low) hesaplar.
     */
    public prioritize(task: NormalizedTask): TaskPriorityType {
        const text = `${task.title} ${task.description} ${(task.metadata?.labels || []).join(' ')}`.toLowerCase();

        // 1. Critical Koşulları (Güvenlik, çökme, sızıntı vb.)
        if (text.includes('security') || 
            text.includes('leak') || 
            text.includes('vulnerability') || 
            text.includes('crash') || 
            text.includes('critical') ||
            text.includes('blocker')
        ) {
            return 'critical';
        }

        // 2. High Koşulları (Acil, hata çözümü vb.)
        if (text.includes('urgent') || 
            text.includes('error') || 
            text.includes('high') || 
            task.category === 'bug'
        ) {
            return 'high';
        }

        // 3. Low Koşulları (Önemsiz, temizlik, refactor vb.)
        if (text.includes('minor') || 
            text.includes('formatting') || 
            text.includes('low') || 
            task.category === 'refactor'
        ) {
            return 'low';
        }

        // 4. Default: Medium
        return 'medium';
    }
}
