import { ContextPackage } from '../../context/types';
import { ComplexityLevel, TaskIntent } from '../shared/reasoningTypes';

export interface ComplexityResult {
    level: ComplexityLevel;
    score: number;
}

export class ComplexityAnalyzer {
    /**
     * Görevin karmaşıklığını ve puanını hesaplar.
     */
    public analyze(taskDescription: string, intent: TaskIntent, context?: ContextPackage): ComplexityResult {
        let score = 0;

        // 1. Task açıklaması uzunluğu ve kelime sayısı etkisi (0 - 2 puan)
        const wordCount = taskDescription.split(/\s+/).filter(Boolean).length;
        if (wordCount > 30) {
            score += 2;
        } else if (wordCount > 15) {
            score += 1;
        }

        // 2. ContextPackage varsa oradaki detaylardan puanlama
        if (context) {
            // Dosya sayısı etkisi: 1-2 dosya (0), 3-5 (2), 6-10 (4), 10+ (6)
            const fileCount = context.relatedFiles?.length || 0;
            if (fileCount > 10) {
                score += 6;
            } else if (fileCount >= 6) {
                score += 4;
            } else if (fileCount >= 3) {
                score += 2;
            }

            // Modül sayısı etkisi: 1 modül (0), 2-3 (1), 4+ (2)
            const moduleCount = context.relatedModules?.length || 0;
            if (moduleCount >= 4) {
                score += 2;
            } else if (moduleCount >= 2) {
                score += 1;
            }

            // Bilinen sorunlar (known issues) etkisi (maks +3)
            const knownIssuesCount = context.knownIssues?.length || 0;
            score += Math.min(3, knownIssuesCount);

            // Mimari güven etkisi: Düşük confidence -> +2 zorluk
            const archConfidence = context.architecture?.confidence ?? 1;
            if (archConfidence < 0.5) {
                score += 2;
            } else if (archConfidence < 0.8) {
                score += 1;
            }
        }

        // 3. Task tipi (intent) etkisi
        // Security ve Architecture görevleri otomatik olarak ek zorluk (+2) getirir.
        if (intent === 'security' || intent === 'architecture') {
            score += 2;
        } else if (intent === 'bugfix' || intent === 'refactor') {
            score += 1;
        }

        // 4. Seviyeye eşleme
        // Score aralığı kabaca 0 ila 18+ arasındadır.
        let level: ComplexityLevel = 'simple';
        if (score >= 12) {
            level = 'critical';
        } else if (score >= 7) {
            level = 'complex';
        } else if (score >= 3) {
            level = 'medium';
        }

        return {
            level,
            score
        };
    }
}
