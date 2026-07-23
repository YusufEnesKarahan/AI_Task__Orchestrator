import { ExecutionPlan, ReasoningValidationResult } from '../shared/reasoningTypes';

export class DecisionValidator {
    /**
     * Reasoning sonucunda oluşan planın doğruluğunu denetler.
     */
    public validate(plan: ExecutionPlan): ReasoningValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // 1. Eksik adım kontrolü
        if (!plan.steps || plan.steps.length === 0) {
            errors.push('Plan herhangi bir adım (step) içermiyor.');
        }

        // 2. Boş strateji kontrolü
        if (!plan.strategy) {
            errors.push('Planda geçerli bir strateji (strategy) tanımlanmamış.');
        }

        // 3. Geçersiz veya bilinmeyen görev/niyet kontrolü
        if (plan.intent === 'unknown') {
            errors.push('Görev niyeti (intent) sınıflandırılamadı (unknown).');
        }

        // 4. Döngüsel bağımlılık (Cycle Detection) kontrolü
        if (this.hasCyclicDependencies(plan)) {
            errors.push('Plan adımları arasında döngüsel bağımlılık (circular dependency) tespit edildi.');
        }

        // 5. Çelişen karar/adımlar kontrolü (Heuristic)
        this.checkConflictingSteps(plan, errors, warnings);

        // 6. Riskli işlem kontrolü
        plan.steps.forEach(step => {
            if (step.risk === 'critical') {
                warnings.push(`Kritik risk barındıran adım tespit edildi: "${step.title}".`);
            }
        });

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * DFS kullanarak adımlar arasında döngüsel bağımlılık olup olmadığını tespit eder.
     */
    private hasCyclicDependencies(plan: ExecutionPlan): boolean {
        const adj = new Map<string, string[]>();
        
        // Komşuluk listesi oluştur (Dependencies listesinden tersine graf kuruyoruz: dep -> step)
        // Ya da doğrudan: step -> dependencies. Fark etmez, herhangi bir yönde cycle varsa döngü vardır.
        plan.steps.forEach(step => {
            adj.set(step.id, step.dependencies || []);
        });

        const visited = new Set<string>();
        const recStack = new Set<string>();

        const dfs = (node: string): boolean => {
            if (recStack.has(node)) return true; // Cycle detected
            if (visited.has(node)) return false;

            visited.add(node);
            recStack.add(node);

            const neighbors = adj.get(node) || [];
            for (const neighbor of neighbors) {
                if (dfs(neighbor)) return true;
            }

            recStack.delete(node);
            return false;
        };

        for (const step of plan.steps) {
            if (dfs(step.id)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Adım başlık ve açıklamalarına bakarak çelişkili veya mantıksız durumları kontrol eder.
     */
    private checkConflictingSteps(plan: ExecutionPlan, errors: string[], warnings: string[]) {
        let hasDelete = false;
        let hasCreate = false;

        plan.steps.forEach(step => {
            const titleLower = step.title.toLowerCase();
            const descLower = step.description.toLowerCase();

            if (titleLower.includes('sil') || descLower.includes('delete') || descLower.includes('remove')) {
                hasDelete = true;
            }
            if (titleLower.includes('oluştur') || descLower.includes('create') || descLower.includes('new file')) {
                hasCreate = true;
            }
        });

        // Hem kökten silme hem de oluşturma aynı basit sequential planda varsa uyarı verelim
        if (hasDelete && hasCreate && plan.strategy === 'sequential') {
            warnings.push('Aynı basit planda hem silme hem de oluşturma adımları mevcut. Etki analizini gözden geçirin.');
        }
    }
}
