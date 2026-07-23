export interface RemediationStrategy {
    strategy: 'fix_architecture' | 'fix_code_quality' | 'fix_tests' | 'fix_security' | 'retry_general';
    focusedPrompt: string;
}

export class DecisionEngine {
    /**
     * Kod inceleme (Review) bulgularını analiz ederek düzeltme stratejisi önerir.
     */
    public analyze(score: number, findings: string[]): RemediationStrategy {
        const text = findings.join(' ').toLowerCase();

        if (text.includes('architecture') || text.includes('dependency') || text.includes('coupling')) {
            return {
                strategy: 'fix_architecture',
                focusedPrompt: 'İnceleme mimari kuralların ihlal edildiğini bildirdi. Lütfen katman kurallarına (SOLID, Clean Architecture) uyun.'
            };
        }
        if (text.includes('complexity') || text.includes('nest') || text.includes('quality') || text.includes('nesting')) {
            return {
                strategy: 'fix_code_quality',
                focusedPrompt: 'İnceleme kod kalitesinin düşük veya derin iç içe yapılar barındırdığını bildirdi. Kodu daha küçük parçalara bölün.'
            };
        }
        if (text.includes('test') || text.includes('coverage')) {
            return {
                strategy: 'fix_tests',
                focusedPrompt: 'İnceleme test kapsamının yetersiz olduğunu veya test dosyasının bulunamadığını bildirdi. Test ekleyin veya düzenleyin.'
            };
        }
        if (text.includes('security') || text.includes('leak') || text.includes('eval') || text.includes('secret')) {
            return {
                strategy: 'fix_security',
                focusedPrompt: 'İnceleme güvenlik açığı veya hassas veri sızıntısı (örn. API Key, eval kullanımı) bildirdi. Güvenlik kriterlerini düzeltin.'
            };
        }

        return {
            strategy: 'retry_general',
            focusedPrompt: 'Genel inceleme doğrulaması başarısız oldu. Hataları gidererek tekrar deneyin.'
        };
    }
}
