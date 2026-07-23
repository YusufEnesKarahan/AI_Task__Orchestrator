import { WorkflowDefinition } from '../shared/workflowTypes';

export const FeatureDevelopmentTemplate: WorkflowDefinition = {
    name: 'Feature Development',
    description: 'Yeni bir özellik geliştirme akışı (Planla -> Kodla -> İncele -> Test Et)',
    steps: [
        {
            name: 'Planlama ve Tasarım',
            type: 'execution',
            payload: {
                agentId: 'planner',
                taskDescription: 'Özellik geliştirme planı oluştur'
            },
            failurePolicy: 'retry',
            maxRetries: 2
        },
        {
            name: 'Kodlama Aşaması',
            type: 'action',
            payload: [
                {
                    type: 'create_file',
                    payload: { path: 'src/features/newFeature.ts', content: '// Yeni özellik kodu' }
                }
            ],
            failurePolicy: 'rollback'
        },
        {
            name: 'Kod Değerlendirme',
            type: 'review',
            payload: ['CodeQualityReview', 'TestCoverageReview'],
            failurePolicy: 'ignore'
        }
    ]
};

export const BugFixTemplate: WorkflowDefinition = {
    name: 'Bug Fix',
    description: 'Hata giderme iş akışı (Hata analizi -> Çözümü uygula -> Güvenlik & Kalite kontrol)',
    steps: [
        {
            name: 'Hata Çözüm Planı',
            type: 'execution',
            payload: {
                agentId: 'planner',
                taskDescription: 'Hatanın kök nedenini analiz et ve çözüm taslağı hazırlak'
            }
        },
        {
            name: 'Hata Düzeltme Uygulaması',
            type: 'action',
            payload: [
                {
                    type: 'apply_patch',
                    payload: { path: 'src/features/newFeature.ts', patch: 'SEARCH\n// Yeni özellik kodu\n=======\n// Yeni özellik düzeltilmiş kod\n>>>>>>>' }
                }
            ],
            failurePolicy: 'rollback'
        },
        {
            name: 'Güvenlik Kontrolü',
            type: 'review',
            payload: ['SecurityReview', 'CodeQualityReview']
        }
    ]
};

export const RefactorTemplate: WorkflowDefinition = {
    name: 'Refactor',
    description: 'Kod iyileştirme iş akışı (Yapısal analiz -> Kodu düzenleme -> Katmanlı mimari kontrol)',
    steps: [
        {
            name: 'Refactoring Analizi',
            type: 'execution',
            payload: {
                agentId: 'planner',
                taskDescription: 'Kod iyileştirme hedeflerini belirle'
            }
        },
        {
            name: 'Yapısal Kod Değişikliği',
            type: 'action',
            payload: [
                {
                    type: 'edit_file',
                    payload: { path: 'src/features/newFeature.ts', content: '// İyileştirilmiş kod' }
                }
            ],
            failurePolicy: 'rollback'
        },
        {
            name: 'Mimari Kurallar Değerlendirmesi',
            type: 'review',
            payload: ['ArchitectureReview']
        }
    ]
};

export const CodeReviewTemplate: WorkflowDefinition = {
    name: 'Code Review',
    description: 'Kapsamlı kod inceleme akışı',
    steps: [
        {
            name: 'Kod Kalitesi, Güvenlik ve Performans İncelemesi',
            type: 'review',
            payload: ['ArchitectureReview', 'CodeQualityReview', 'SecurityReview', 'PerformanceReview']
        }
    ]
};

export const DocumentationTemplate: WorkflowDefinition = {
    name: 'Documentation',
    description: 'Belgelendirme iş akışı (İçerik planlama -> Dökümanları yazma)',
    steps: [
        {
            name: 'Dökümantasyon Planı',
            type: 'execution',
            payload: {
                agentId: 'planner',
                taskDescription: 'Döküman içeriği başlıklarını belirle'
            }
        },
        {
            name: 'Belge Yazımı',
            type: 'action',
            payload: [
                {
                    type: 'create_file',
                    payload: { path: 'docs/README.md', content: '# Özellik Kullanım Kılavuzu' }
                }
            ]
        }
    ]
};
