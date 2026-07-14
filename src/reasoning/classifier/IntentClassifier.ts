import { ContextPackage } from '../../context/types';
import { TaskIntent } from '../shared/reasoningTypes';

interface IntentPattern {
    intent: TaskIntent;
    keywords: string[];
    weight: number;
}

interface ClassificationResult {
    intent: TaskIntent;
    confidence: number;
    matchedKeywords: string[];
}

const INTENT_PATTERNS: IntentPattern[] = [
    {
        intent: 'feature',
        keywords: [
            'ekle', 'yeni', 'oluştur', 'implement', 'geliştir', 'add', 'create', 'build',
            'feature', 'özellik', 'yap', 'entegre', 'integrate', 'kur', 'setup'
        ],
        weight: 1.0
    },
    {
        intent: 'bugfix',
        keywords: [
            'hata', 'bug', 'fix', 'düzelt', 'onar', 'error', 'broken', 'crash', 'fail',
            'çalışmıyor', 'sorun', 'problem', 'düzeltme', 'repair', 'resolve', 'patch'
        ],
        weight: 1.1
    },
    {
        intent: 'refactor',
        keywords: [
            'refactor', 'yeniden yaz', 'temizle', 'clean', 'reorganize', 'düzenle',
            'iyileştir', 'optimize structure', 'restructure', 'modüler', 'modular',
            'split', 'extract', 'taşı', 'move', 'rename'
        ],
        weight: 1.0
    },
    {
        intent: 'review',
        keywords: [
            'review', 'incele', 'kontrol', 'check', 'gözden geçir', 'audit', 'inceleme',
            'analyze code', 'inspect', 'look at', 'bak', 'değerlendir', 'evaluate'
        ],
        weight: 0.9
    },
    {
        intent: 'documentation',
        keywords: [
            'döküman', 'document', 'dokümantasyon', 'documentation', 'readme', 'comment',
            'yorum', 'açıkla', 'explain', 'jsdoc', 'typedoc', 'guide', 'kılavuz', 'wiki'
        ],
        weight: 0.9
    },
    {
        intent: 'analysis',
        keywords: [
            'analiz', 'analysis', 'analyze', 'incele', 'araştır', 'investigate', 'report',
            'rapor', 'değerlendir', 'assess', 'measure', 'ölç', 'istatistik', 'statistics'
        ],
        weight: 0.9
    },
    {
        intent: 'test',
        keywords: [
            'test', 'tests', 'spec', 'unit test', 'e2e', 'integration test', 'coverage',
            'kapsam', 'mock', 'stub', 'jest', 'mocha', 'describe', 'testleri yaz', 'doğrula'
        ],
        weight: 1.0
    },
    {
        intent: 'performance',
        keywords: [
            'performans', 'performance', 'optimize', 'optimizasyon', 'hızlandır', 'speed',
            'memory', 'hafıza', 'cache', 'lazy', 'bottleneck', 'profil', 'profiling', 'yavaş', 'slow'
        ],
        weight: 1.0
    },
    {
        intent: 'security',
        keywords: [
            'güvenlik', 'security', 'auth', 'authentication', 'authorization', 'yetkilendirme',
            'vulnerability', 'açık', 'xss', 'csrf', 'injection', 'sanitize', 'validate',
            'token', 'jwt', 'encrypt', 'şifrele', 'ssl', 'https', 'permission', 'izin'
        ],
        weight: 1.2 // Security gets higher weight for safety
    },
    {
        intent: 'architecture',
        keywords: [
            'mimari', 'architecture', 'design', 'tasarım', 'pattern', 'desen', 'solid',
            'clean architecture', 'domain', 'layer', 'katman', 'module', 'modül', 'structure',
            'coupling', 'cohesion', 'dependency', 'bağımlılık', 'interface', 'abstraction'
        ],
        weight: 1.0
    }
];

export class IntentClassifier {
    /**
     * Görev açıklamasını ve isteğe bağlı context'i analiz ederek görev niyetini sınıflandırır.
     */
    public classify(taskDescription: string, context?: ContextPackage): ClassificationResult {
        const normalizedText = taskDescription.toLowerCase();
        const scores = new Map<TaskIntent, { score: number; matched: string[] }>();

        // Anahtar kelime tabanlı skoring
        for (const pattern of INTENT_PATTERNS) {
            let score = 0;
            const matchedKeywords: string[] = [];

            for (const keyword of pattern.keywords) {
                if (normalizedText.includes(keyword.toLowerCase())) {
                    score += pattern.weight;
                    matchedKeywords.push(keyword);
                }
            }

            if (score > 0) {
                scores.set(pattern.intent, { score, matched: matchedKeywords });
            }
        }

        // Context cross-check: taskType varsa boost ver
        if (context?.taskType) {
            const contextIntent = this.mapTaskTypeToIntent(context.taskType);
            if (contextIntent && contextIntent !== 'unknown') {
                const existing = scores.get(contextIntent);
                scores.set(contextIntent, {
                    score: (existing?.score || 0) + 0.5,
                    matched: existing?.matched || []
                });
            }
        }

        if (scores.size === 0) {
            return {
                intent: 'unknown',
                confidence: 0,
                matchedKeywords: []
            };
        }

        // En yüksek skoru bul
        let bestIntent: TaskIntent = 'unknown';
        let bestScore = 0;
        let bestMatched: string[] = [];

        for (const [intent, data] of scores.entries()) {
            if (data.score > bestScore) {
                bestScore = data.score;
                bestIntent = intent;
                bestMatched = data.matched;
            }
        }

        // Confidence: matched keyword sayısı / toplam pattern keyword sayısı (normalize)
        const maxPossibleScore = INTENT_PATTERNS.find(p => p.intent === bestIntent)?.keywords.length || 1;
        const confidence = Math.min(1, bestScore / (maxPossibleScore * 0.5));

        return {
            intent: bestIntent,
            confidence: Math.round(confidence * 100) / 100,
            matchedKeywords: bestMatched
        };
    }

    private mapTaskTypeToIntent(taskType: string): TaskIntent | null {
        const mapping: Record<string, TaskIntent> = {
            code_generation: 'feature',
            refactor: 'refactor',
            bug_fix: 'bugfix',
            test_generation: 'test',
            documentation: 'documentation',
            code_review: 'review',
            feature: 'feature',
            fix: 'bugfix',
            review: 'review',
            planning: 'analysis'
        };
        return mapping[taskType] || null;
    }
}
