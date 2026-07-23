import { ContextPackage } from '../../context/types';
import {
    ComplexityLevel,
    ExecutionPlan,
    ExecutionStep,
    ReasoningStrategy,
    RiskLevel,
    StepPriority,
    TaskIntent
} from '../shared/reasoningTypes';

export class PlanningEngine {
    /**
     * Strateji, zorluk ve niyete göre bir ExecutionPlan oluşturur.
     */
    public buildExecutionPlan(
        taskDescription: string,
        intent: TaskIntent,
        complexity: ComplexityLevel,
        strategy: ReasoningStrategy,
        context?: ContextPackage
    ): ExecutionPlan {
        const steps: ExecutionStep[] = [];
        const planId = `plan_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        // Risk skoru ve güven (confidence) hesaplaması
        let riskScore = 0.2; // default low base risk
        if (complexity === 'medium') riskScore = 0.4;
        if (complexity === 'complex') riskScore = 0.7;
        if (complexity === 'critical') riskScore = 0.95;

        // Ekstra risk durumları
        if (intent === 'security' || intent === 'architecture') {
            riskScore = Math.min(1.0, riskScore + 0.1);
        }

        let confidence = 0.9;
        if (complexity === 'complex') confidence = 0.8;
        if (complexity === 'critical') confidence = 0.65;

        // Stratejilere göre farklı plan şablonları oluşturalım
        switch (strategy) {
            case 'sequential':
                this.buildSequentialSteps(steps, taskDescription, intent, complexity);
                break;

            case 'divide_and_conquer':
                this.buildDivideAndConquerSteps(steps, taskDescription, intent, complexity, context);
                break;

            case 'tree_of_thought':
                this.buildTreeOfThoughtSteps(steps, taskDescription, intent, complexity);
                break;

            case 'review_first':
                this.buildReviewFirstSteps(steps, taskDescription, complexity);
                break;

            case 'architecture_first':
                this.buildArchitectureFirstSteps(steps, taskDescription, complexity, context);
                break;

            case 'memory_first':
                this.buildMemoryFirstSteps(steps, taskDescription, complexity);
                break;

            case 'rule_based':
                this.buildRuleBasedSteps(steps, taskDescription, complexity);
                break;

            default:
                // Fallback to sequential
                this.buildSequentialSteps(steps, taskDescription, intent, complexity);
                break;
        }

        const estimatedEffortHours = this.estimateEffort(complexity, steps.length);

        return {
            id: planId,
            createdAt: Date.now(),
            strategy,
            complexity,
            intent,
            steps,
            confidence,
            riskScore,
            estimatedEffortHours
        };
    }

    private buildSequentialSteps(
        steps: ExecutionStep[],
        taskDescription: string,
        intent: TaskIntent,
        complexity: ComplexityLevel
    ) {
        steps.push({
            id: 'step_1_analysis',
            title: 'Gereksinim Analizi ve Hazırlık',
            description: `Görevin (${taskDescription.slice(0, 50)}...) gereksinimlerini belirle ve gerekli çalışma dosyalarını tespit et.`,
            priority: 'high',
            dependencies: [],
            expectedOutput: 'Hedef dosyalar ve etki analizi listesi',
            risk: 'low'
        });

        steps.push({
            id: 'step_2_implementation',
            title: 'Kodlama/Uygulama Adımı',
            description: `İstenen değişikliği/özelliği belirlenen dosyalarda uygula.`,
            priority: 'high',
            dependencies: ['step_1_analysis'],
            expectedOutput: 'Değişikliklerin uygulandığı kaynak kod',
            risk: complexity === 'medium' ? 'medium' : 'low'
        });

        steps.push({
            id: 'step_3_verification',
            title: 'Doğrulama ve Test',
            description: 'Yapılan değişikliklerin çalışırlığını test et ve doğrula.',
            priority: 'medium',
            dependencies: ['step_2_implementation'],
            expectedOutput: 'Başarılı test çıktıları ve doğrulama raporu',
            risk: 'low'
        });
    }

    private buildDivideAndConquerSteps(
        steps: ExecutionStep[],
        taskDescription: string,
        intent: TaskIntent,
        complexity: ComplexityLevel,
        context?: ContextPackage
    ) {
        // Büyük problemi alt parçalara bölme adımları
        steps.push({
            id: 'step_1_decomposition',
            title: 'Görev Parçalama ve Alt Yapı Tasarımı',
            description: 'Görevi bağımsız alt modüllere ve iş birimlerine ayır.',
            priority: 'high',
            dependencies: [],
            expectedOutput: 'Bölünmüş alt görev listesi ve arayüz tanımları',
            risk: 'medium'
        });

        // İlgili dosyalar varsa her birini veya ana kısımları paralel/bağımsız adımlar olarak belirleyelim
        const files = context?.relatedFiles || [];
        if (files.length > 0) {
            files.slice(0, 3).forEach((file, index) => {
                const stepNum = index + 2;
                steps.push({
                    id: `step_${stepNum}_subtask`,
                    title: `Alt Görev ${index + 1}: ${file.split('/').pop()} İşlenmesi`,
                    description: `${file} üzerinde gerekli değişikliklerin yapılması ve alt birimin izole tamamlanması.`,
                    priority: 'high',
                    dependencies: ['step_1_decomposition'],
                    expectedOutput: `${file} güncellemesi`,
                    risk: 'medium'
                });
            });
        } else {
            steps.push({
                id: 'step_2_subtask_core',
                title: 'Çirdek Modül Geliştirilmesi',
                description: 'İş mantığının ana çekirdek parçalarının kodlanması.',
                priority: 'high',
                dependencies: ['step_1_decomposition'],
                expectedOutput: 'Çekirdek kod değişiklikleri',
                risk: 'medium'
            });
            steps.push({
                id: 'step_3_subtask_integration',
                title: 'Entegrasyon Katmanının Yapılandırılması',
                description: 'Çekirdek kod ile dış servislerin/arayüzlerin bağlanması.',
                priority: 'high',
                dependencies: ['step_1_decomposition'],
                expectedOutput: 'Entegrasyon kodları',
                risk: 'medium'
            });
        }

        const subtaskIds = steps.filter(s => s.id.includes('subtask')).map(s => s.id);

        steps.push({
            id: 'step_final_integration',
            title: 'Modüllerin Birleştirilmesi ve Entegrasyon Testi',
            description: 'Tüm alt parçaları bir araya getir ve uçtan uca veri akışını doğrula.',
            priority: 'high',
            dependencies: subtaskIds,
            expectedOutput: 'Birleştirilmiş çalışan sistem',
            risk: complexity === 'complex' ? 'high' : 'medium'
        });
    }

    private buildTreeOfThoughtSteps(
        steps: ExecutionStep[],
        taskDescription: string,
        intent: TaskIntent,
        complexity: ComplexityLevel
    ) {
        steps.push({
            id: 'step_1_problem_space',
            title: 'Problem Alanı ve Kısıtların Analizi',
            description: 'Görevin sınır şartlarını, güvenlik kısıtlarını ve potansiyel yan etkilerini analiz et.',
            priority: 'high',
            dependencies: [],
            expectedOutput: 'Kısıtlar listesi ve problem modeli',
            risk: 'medium'
        });

        steps.push({
            id: 'step_2_generate_alternatives',
            title: 'Alternatif Çözüm Yollarının Üretilmesi',
            description: 'En az iki veya üç farklı tasarım/çözüm alternatifi oluştur.',
            priority: 'high',
            dependencies: ['step_1_problem_space'],
            expectedOutput: 'A/B/C Çözüm önerisi dokümanı',
            risk: 'low'
        });

        steps.push({
            id: 'step_3_eval_and_select',
            title: 'Alternatiflerin Değerlendirilmesi ve Seçim',
            description: 'Performans, güvenlik ve sürdürülebilirlik kriterlerine göre en iyi yolu seç.',
            priority: 'high',
            dependencies: ['step_2_generate_alternatives'],
            expectedOutput: 'Seçilen tasarım kararı ve gerekçesi',
            risk: 'high'
        });

        steps.push({
            id: 'step_4_execution',
            title: 'Seçilen Çözümün Uygulanması',
            description: 'Kararlaştırılan tasarımı hayata geçir.',
            priority: 'high',
            dependencies: ['step_3_eval_and_select'],
            expectedOutput: 'Uygulanmış kod tabanı',
            risk: complexity === 'critical' ? 'critical' : 'high'
        });

        steps.push({
            id: 'step_5_post_verification',
            title: 'Kritik Güvenlik ve Doğrulama Testi',
            description: 'Uygulanan kritik çözümün güvenlik açığı yaratmadığından emin ol.',
            priority: 'high',
            dependencies: ['step_4_execution'],
            expectedOutput: 'Güvenlik ve sağlamlık doğrulama raporu',
            risk: 'medium'
        });
    }

    private buildReviewFirstSteps(steps: ExecutionStep[], taskDescription: string, complexity: ComplexityLevel) {
        steps.push({
            id: 'step_1_gather_code',
            title: 'Hedef Kod Bloklarının Toplanması',
            description: 'İnceleme yapılacak kodları, fonksiyonları veya PR içeriğini çek.',
            priority: 'high',
            dependencies: [],
            expectedOutput: 'İncelenecek kod kümesi',
            risk: 'low'
        });

        steps.push({
            id: 'step_2_code_inspection',
            title: 'Kod İnceleme ve Bulguların Listelenmesi',
            description: 'Kod kalitesi, performans, hata olasılığı ve standartlara uygunluk kontrolü yap.',
            priority: 'high',
            dependencies: ['step_1_gather_code'],
            expectedOutput: 'Bulgu ve iyileştirme önerileri listesi',
            risk: 'low'
        });

        steps.push({
            id: 'step_3_report_generation',
            title: 'Review Raporunun Oluşturulması',
            description: 'Yapıcı geri bildirimleri ve kritik düzeltmeleri içeren raporu hazırla.',
            priority: 'medium',
            dependencies: ['step_2_code_inspection'],
            expectedOutput: 'Code Review Raporu (Markdown)',
            risk: 'low'
        });
    }

    private buildArchitectureFirstSteps(
        steps: ExecutionStep[],
        taskDescription: string,
        complexity: ComplexityLevel,
        context?: ContextPackage
    ) {
        steps.push({
            id: 'step_1_arch_scan',
            title: 'Mevcut Mimari Katmanların ve Bağımlılıkların Taranması',
            description: 'Projedeki katmanlı yapıyı, kuralları ve bağımlılık haritasını analiz et.',
            priority: 'high',
            dependencies: [],
            expectedOutput: 'Mimari durum ve bağımlılık analizi',
            risk: 'low'
        });

        steps.push({
            id: 'step_2_design_conformance',
            title: 'Yeni Yapının Mimari Kurallara Uyum Tasarımı',
            description: 'Yeni eklenecek kodların mimari kuralları ihlal etmeyecek şekilde yerleşimini tasarla.',
            priority: 'high',
            dependencies: ['step_1_arch_scan'],
            expectedOutput: 'Uyumlu tasarım şeması',
            risk: 'medium'
        });

        steps.push({
            id: 'step_3_refactor_or_code',
            title: 'Kodlama ve Yapılandırma',
            description: 'Mimariye uygun refactoring veya kod ekleme adımlarını tamamla.',
            priority: 'high',
            dependencies: ['step_2_design_conformance'],
            expectedOutput: 'Mimariye uygun kod güncellemeleri',
            risk: complexity === 'complex' ? 'high' : 'medium'
        });

        steps.push({
            id: 'step_4_dependency_check',
            title: 'Bağımlılık ve Kural İhlal Kontrolü',
            description: 'Kodların mimari sınırları veya import kurallarını çiğnemediğini otomatik doğrula.',
            priority: 'medium',
            dependencies: ['step_3_refactor_or_code'],
            expectedOutput: 'Sıfır mimari ihlal doğrulama sonucu',
            risk: 'low'
        });
    }

    private buildMemoryFirstSteps(steps: ExecutionStep[], taskDescription: string, complexity: ComplexityLevel) {
        steps.push({
            id: 'step_1_read_memory',
            title: 'Hafıza ve Karar Geçmişinin Sorgulanması',
            description: 'Önceki sprintlerden gelen kararları, proje hafızasını ve contexti sorgula.',
            priority: 'high',
            dependencies: [],
            expectedOutput: 'İlgili hafıza kayıtları ve bağlam',
            risk: 'low'
        });

        steps.push({
            id: 'step_2_contextual_analysis',
            title: 'Belleğe Dayalı Etki Analizi',
            description: 'Geçmiş kararlarla çelişen veya onları tamamlayan noktaları belirle.',
            priority: 'high',
            dependencies: ['step_1_read_memory'],
            expectedOutput: 'Bellek etki analizi',
            risk: 'low'
        });

        steps.push({
            id: 'step_3_update_memory',
            title: 'Kararın Belleğe İşlenmesi',
            description: 'Yeni edinilen analiz sonuçlarını ve kararları kalıcı hafızaya (.aios/memory/) yaz.',
            priority: 'medium',
            dependencies: ['step_2_contextual_analysis'],
            expectedOutput: 'Güncellenmiş bellek dosyaları',
            risk: 'low'
        });
    }

    private buildRuleBasedSteps(steps: ExecutionStep[], taskDescription: string, complexity: ComplexityLevel) {
        steps.push({
            id: 'step_1_gather_rules',
            title: 'Uygulanacak Kuralların Toplanması',
            description: 'Kod standartları, test şablonları veya statik kural listesini yükle.',
            priority: 'high',
            dependencies: [],
            expectedOutput: 'Aktif kurallar listesi',
            risk: 'low'
        });

        steps.push({
            id: 'step_2_conformance_check',
            title: 'Kural Uygunluk Analizi ve İyileştirme',
            description: 'Mevcut yapıyı kurallarla kıyaslayıp eksiklikleri tespit et ve tamamla.',
            priority: 'high',
            dependencies: ['step_1_gather_rules'],
            expectedOutput: 'Kurallarla tam uyumlu kod tabanı',
            risk: 'medium'
        });

        steps.push({
            id: 'step_3_verification_run',
            title: 'Test ve Doğrulama Koşusu',
            description: 'Kural uyumluluğunu test veya lint araçlarıyla teyit et.',
            priority: 'high',
            dependencies: ['step_2_conformance_check'],
            expectedOutput: 'Başarılı lint/test sonuçları',
            risk: 'low'
        });
    }

    private estimateEffort(complexity: ComplexityLevel, stepsCount: number): number {
        let baseHours = 1;
        if (complexity === 'medium') baseHours = 3;
        if (complexity === 'complex') baseHours = 8;
        if (complexity === 'critical') baseHours = 18;

        // Her ek adım için +0.5 saat
        return baseHours + (stepsCount * 0.5);
    }
}
