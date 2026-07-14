export class PromptOptimizer {
    /**
     * Boş satırları ve gereksiz boşlukları temizleyerek prompt'u optimize eder.
     * Bu sayede token tasarrufu sağlanır.
     * @param prompt Ham prompt metni
     * @returns Optimize edilmiş prompt metni
     */
    public optimize(prompt: string): string {
        if (!prompt) return prompt;

        // 1. Çoklu ardışık boş satırları tek boş satıra indirge
        let optimized = prompt.replace(/\n{3,}/g, '\n\n');
        
        // 2. Satır başı ve sonu boşlukları temizle
        optimized = optimized.split('\n')
            .map(line => line.trimEnd()) // Satır sonundaki boşlukları al
            .join('\n');

        // 3. Genel metnin başı ve sonunu trimle
        return optimized.trim();
    }
}
