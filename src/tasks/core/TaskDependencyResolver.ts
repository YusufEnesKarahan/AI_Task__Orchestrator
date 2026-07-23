import { NormalizedTask } from '../shared/taskTypes';

export class TaskDependencyResolver {
    /**
     * Görevlerin bağımlılık ilişkilerini çözerek topological olarak sıralanmış listesini döndürür.
     * Döngüsel bağımlılık durumunda hata fırlatır.
     */
    public resolve(tasks: NormalizedTask[]): NormalizedTask[] {
        const sorted: NormalizedTask[] = [];
        const visiting = new Set<string>();
        const visited = new Set<string>();

        const taskMap = new Map<string, NormalizedTask>();
        for (const t of tasks) {
            taskMap.set(t.id, t);
        }

        const visit = (task: NormalizedTask) => {
            if (visiting.has(task.id)) {
                throw new Error(`Döngüsel bağımlılık (Circular Dependency) tespit edildi: "${task.id}"`);
            }
            if (!visited.has(task.id)) {
                visiting.add(task.id);
                for (const depId of task.dependencies) {
                    const depTask = taskMap.get(depId);
                    if (depTask) {
                        visit(depTask);
                    }
                }
                visiting.delete(task.id);
                visited.add(task.id);
                sorted.push(task);
            }
        };

        for (const t of tasks) {
            visit(t);
        }

        return sorted;
    }
}
