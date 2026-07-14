import { AIChatMessage } from '../shared/aiTypes';
import { ModelRegistry } from '../registry/ModelRegistry';

export class PromptValidator {
    /**
     * Mesaj dizisini modelin bağlam penceresi (context window) sınırları içinde olup olmadığını doğrular.
     * @param modelId Kullanılacak modelin ID'si
     * @param messages Gönderilecek mesajlar
     * @returns Geçerliyse true, değilse false
     */
    public validate(modelId: string, messages: AIChatMessage[]): boolean {
        const registry = ModelRegistry.getInstance();
        const modelInfo = registry.getModel(modelId);

        if (!modelInfo) {
            throw new Error(`[PromptValidator] Unknown model ID: ${modelId}`);
        }

        const estimatedTokens = this.estimateTokens(messages);
        
        // Bir miktar tolerans bırakıyoruz (örn. output tokenları için %20 alan)
        const maxAllowedTokens = modelInfo.contextWindow * 0.8;
        
        if (estimatedTokens > maxAllowedTokens) {
            console.warn(`[PromptValidator] Prompt exceeds safe token limit! Estimated: ${estimatedTokens}, Allowed (80%): ${maxAllowedTokens}`);
            return false;
        }

        return true;
    }

    /**
     * Basit ve hızlı bir token tahmini yapar. 
     * Gerçek token sayısı modele göre (tiktoken vs.) değişebilir, 
     * burada 1 token ~= 4 karakter genel kabulünü kullanıyoruz.
     */
    private estimateTokens(messages: AIChatMessage[]): number {
        const text = messages.map(m => m.content).join('\n');
        return Math.ceil(text.length / 4);
    }
}
