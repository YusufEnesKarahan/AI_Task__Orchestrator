import { ContextPackage } from '../../context/types';
import { ComplexityLevel, ReasoningStrategy, TaskIntent } from '../shared/reasoningTypes';

export class StrategyEngine {
    /**
     * Intent ve Complexity seviyesine göre en uygun Reasoning stratejisini seçer.
     */
    public selectStrategy(
        intent: TaskIntent,
        complexity: ComplexityLevel,
        context?: ContextPackage
    ): ReasoningStrategy {
        // Eğer kritik bir zorluk varsa otomatik olarak tree_of_thought seçelim
        if (complexity === 'critical') {
            return 'tree_of_thought';
        }

        // Görev tipine (intent) göre yönlendirme
        switch (intent) {
            case 'security':
                // Güvenlik görevleri karmaşıksa alternatifli düşünme (tree_of_thought), basitse sequential
                return complexity === 'complex' ? 'tree_of_thought' : 'rule_based';

            case 'architecture':
            case 'refactor':
                // Mimari ve refactor işleri her zaman mimari önceliklidir
                return 'architecture_first';

            case 'review':
                return 'review_first';

            case 'test':
                return 'rule_based';

            case 'bugfix':
                if (complexity === 'complex') {
                    return 'divide_and_conquer';
                }
                return 'sequential';

            case 'feature':
                if (complexity === 'complex' || complexity === 'medium') {
                    return 'divide_and_conquer';
                }
                return 'sequential';

            case 'documentation':
                return 'sequential';

            case 'analysis':
                return 'memory_first';

            default:
                return 'sequential';
        }
    }
}
