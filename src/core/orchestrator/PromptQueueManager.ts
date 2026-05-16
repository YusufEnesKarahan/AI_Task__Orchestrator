import { EventEmitter } from 'events';
import {
    Prompt,
    PromptStatus,
    isValidTransition
} from '../types/prompt.types';
import { IAIProvider } from '../../providers/interfaces/IAIProvider';
import { IStateManager } from '../../store/interfaces/IStateManager';
import { PromptExecutionService } from './PromptExecutionService';

// ---------------------------------------------------------------------------
// Olay Tipleri
// ---------------------------------------------------------------------------

export interface QueueEvents {
    promptStatusChanged: (prompt: Prompt, oldStatus: PromptStatus, newStatus: PromptStatus) => void;
    queueStarted: () => void;
    queueCompleted: (results: QueueExecutionSummary) => void;
    queueError: (prompt: Prompt, error: string) => void;
}

export interface QueueExecutionSummary {
    total: number;
    completed: number;
    failed: number;
    cancelled: number;
    durationMs: number;
}

// ---------------------------------------------------------------------------
// PromptQueueManager
// ---------------------------------------------------------------------------

export class PromptQueueManager {
    private readonly events = new EventEmitter();
    private readonly stateManager: IStateManager;
    private readonly executionService: PromptExecutionService;
    private aiProvider?: IAIProvider;
    private isProcessing = false;
    private cancelRequested = false;

    /** Hata durumunda kuyruğun iptal edilip edilmeyeceğini belirler. Varsayılan: true (Devam et) */
    public continueOnFailure: boolean = true;

    constructor(stateManager: IStateManager, aiProvider?: IAIProvider) {
        this.stateManager = stateManager;
        this.aiProvider = aiProvider;
        this.executionService = new PromptExecutionService();
    }

    /**
     * AI Provider'ı sonradan güncellemek için (Orchestrator bootstrap sonrası).
     */
    public setProvider(provider?: IAIProvider): void {
        this.aiProvider = provider;
    }

    public isRunning(): boolean {
        return this.isProcessing;
    }

    // -----------------------------------------------------------------------
    // Olay Aboneliği
    // -----------------------------------------------------------------------

    public on<K extends keyof QueueEvents>(event: K, listener: QueueEvents[K]): () => void {
        this.events.on(event, listener);
        return () => { this.events.off(event, listener); };
    }

    // -----------------------------------------------------------------------
    // Status Geçişleri
    // -----------------------------------------------------------------------

    /**
     * Tek bir prompt'un statüsünü güvenli şekilde değiştirir.
     * Geçersiz geçişlerde hata fırlatır.
     */
    public async transition(promptId: string, newStatus: PromptStatus): Promise<Prompt> {
        const state = await this.stateManager.getState();
        const prompt = state.prompts.find(p => p.id === promptId);

        if (!prompt) {
            throw new Error(`Prompt bulunamadı: ${promptId}`);
        }

        if (!isValidTransition(prompt.status, newStatus)) {
            throw new Error(
                `Geçersiz status geçişi: ${prompt.status} → ${newStatus} (Prompt: ${prompt.title})`
            );
        }

        const oldStatus = prompt.status;
        const updates: Partial<Prompt> = { status: newStatus };

        // Zaman damgalarını otomatik doldur
        if (newStatus === 'approved') { updates.approvedAt = Date.now(); }
        if (newStatus === 'sending') { updates.sentAt = Date.now(); }
        if (newStatus === 'completed') { updates.completedAt = Date.now(); }

        await this.stateManager.updatePrompt(promptId, updates);

        const updatedPrompt = { ...prompt, ...updates, updatedAt: Date.now() };
        this.events.emit('promptStatusChanged', updatedPrompt, oldStatus, newStatus);

        return updatedPrompt;
    }

    /**
     * Birden fazla prompt'u toplu onaylama.
     */
    public async approveMany(promptIds: string[]): Promise<void> {
        for (const id of promptIds) {
            await this.transition(id, 'approved');
        }
    }

    /**
     * Birden fazla prompt'u toplu reddetme.
     */
    public async rejectMany(promptIds: string[]): Promise<void> {
        for (const id of promptIds) {
            await this.transition(id, 'rejected');
        }
    }

    // -----------------------------------------------------------------------
    // Kuyruk Yürütme (Queue Execution)
    // -----------------------------------------------------------------------

    /**
     * Tüm 'approved' statüsündeki promptları sırayla yürütür.
     * Aynı anda sadece BİR prompt işlenir (FIFO).
     */
    public async executeQueue(): Promise<QueueExecutionSummary> {
        if (this.isProcessing) {
            throw new Error('Kuyruk zaten çalışıyor. Aynı anda iki kuyruk başlatılamaz.');
        }

        this.isProcessing = true;
        this.cancelRequested = false;
        this.events.emit('queueStarted');

        const startTime = Date.now();
        const summary: QueueExecutionSummary = {
            total: 0, completed: 0, failed: 0, cancelled: 0, durationMs: 0
        };

        try {
            // Onaylanmış promptları sıraya koy (order'a göre)
            const state = await this.stateManager.getState();
            const approvedPrompts = state.prompts
                .filter(p => p.status === 'approved')
                .sort((a, b) => a.order - b.order);

            summary.total = approvedPrompts.length;

            if (approvedPrompts.length === 0) {
                return summary;
            }

            // Hepsini 'queued' yap
            for (const prompt of approvedPrompts) {
                await this.transition(prompt.id, 'queued');
            }

            // Sırayla işle — aynı anda sadece 1 prompt aktif
            for (const prompt of approvedPrompts) {
                if (this.cancelRequested) {
                    await this.transition(prompt.id, 'cancelled');
                    summary.cancelled++;
                    continue;
                }

                try {
                    await this.executeSinglePrompt(prompt);
                    summary.completed++;
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    this.events.emit('queueError', prompt, errorMsg);
                    summary.failed++;
                    
                    if (!this.continueOnFailure) {
                        break; // Hata durumunda zinciri kır ve kuyruğu durdur
                    }
                }
            }
        } finally {
            this.isProcessing = false;
            this.cancelRequested = false;
            summary.durationMs = Date.now() - startTime;
            this.events.emit('queueCompleted', summary);
        }

        return summary;
    }

    /**
     * Çalışan kuyruğu iptal eder.
     * Mevcut prompt tamamlandıktan sonra sonraki prompt'lar 'cancelled' yapılır.
     */
    public requestCancel(): void {
        if (this.isProcessing) {
            this.cancelRequested = true;
        }
    }

    // -----------------------------------------------------------------------
    // Tekil Prompt Yürütme
    // -----------------------------------------------------------------------

    private async executeSinglePrompt(prompt: Prompt): Promise<void> {
        // 1. Execution mode kontrolü
        if (prompt.executionMode === 'manual' || prompt.executionMode === 'external_chat_placeholder') {
            await this.transition(prompt.id, 'ready_for_manual_send');
            
            // Kullanıcı UI üzerinden süreci tamamlayana kadar kuyruğu beklet
            await this.waitForPromptCompletion(prompt.id);
            if (this.cancelRequested) {
                const state = await this.stateManager.getState();
                const currentPrompt = state.prompts.find(p => p.id === prompt.id);
                if (currentPrompt && isValidTransition(currentPrompt.status, 'cancelled')) {
                    await this.transition(prompt.id, 'cancelled');
                }
            }
            return;
        }

        // 2. internal_ai modu — gerçek AI çağrısı
        if (!this.aiProvider) {
            await this.failPrompt(prompt, 'AI provider yapılandırılmamış. Lütfen ayarlardan bir provider seçin.');
            throw new Error(`AI provider yok: ${prompt.title}`);
        }

        // sending
        await this.transition(prompt.id, 'sending');

        try {
            // waiting_response
            await this.transition(prompt.id, 'waiting_response');

            // PromptExecutionService kullanarak yürüt
            const result = await this.executionService.execute(prompt, this.aiProvider);

            if (result.errorMessage) {
                await this.failPrompt(prompt, result.errorMessage, result);
                throw new Error(result.errorMessage);
            }

            // completed
            const responseText = result.rawResponse || '';
            await this.stateManager.updatePrompt(prompt.id, {
                status: 'completed',
                responseText,
                executionResult: result,
                completedAt: Date.now(),
                provider: this.aiProvider.providerName
            });

            const completedPrompt = { ...prompt, status: 'completed' as const, responseText, executionResult: result };
            this.events.emit('promptStatusChanged', completedPrompt, 'waiting_response', 'completed');

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await this.failPrompt(prompt, message);
            throw error; // Üst katmana (executeQueue) ilet ki summary'de failed sayılsın
        }
    }

    /**
     * Prompt'u hata statüsüne düşürür.
     */
    private async failPrompt(prompt: Prompt, errorMessage: string, executionResult?: any): Promise<void> {
        const updates: Partial<Prompt> = {
            status: 'failed',
            errorMessage
        };
        
        if (executionResult) {
            updates.executionResult = executionResult;
        }

        await this.stateManager.updatePrompt(prompt.id, updates);

        const failedPrompt = { ...prompt, status: 'failed' as const, errorMessage, executionResult };
        this.events.emit('promptStatusChanged', failedPrompt, prompt.status, 'failed');
    }

    /**
     * Verilen prompt tamamlanana kadar (veya hata alana kadar) promise'i bekletir.
     */
    private waitForPromptCompletion(promptId: string): Promise<void> {
        return new Promise((resolve) => {
            const cleanup = () => {
                clearInterval(cancelPollId);
                this.events.off('promptStatusChanged', listener);
            };

            const listener = (updatedPrompt: Prompt, oldStatus: PromptStatus, newStatus: PromptStatus) => {
                void oldStatus;
                if (updatedPrompt.id === promptId) {
                    if (['manually_completed', 'completed', 'failed', 'cancelled'].includes(newStatus)) {
                        cleanup();
                        resolve();
                    }
                }
            };

            const cancelPollId = setInterval(() => {
                if (this.cancelRequested) {
                    cleanup();
                    resolve();
                }
            }, 250);

            this.events.on('promptStatusChanged', listener);
        });
    }
}

// ---------------------------------------------------------------------------
// ÖRNEK KUYRUK AKIŞI (Pseudocode)
// ---------------------------------------------------------------------------
//
// const queueManager = new PromptQueueManager(stateManager, aiProvider);
//
// // 1. Promptlar üretilir (status: 'draft')
// await stateManager.addPrompt(createPrompt({ ... }));
//
// // 2. Kullanıcı inceler, onaylar
// await queueManager.approveMany(['prompt_1', 'prompt_2', 'prompt_3']);
//
// // 3. Kuyruk çalıştırılır
// queueManager.on('promptStatusChanged', (prompt, from, to) => {
//     console.log(`${prompt.title}: ${from} → ${to}`);
//     // UI'ı güncelle
// });
//
// const summary = await queueManager.executeQueue();
// console.log(`Toplam: ${summary.total}, Başarılı: ${summary.completed}, Hatalı: ${summary.failed}`);
//
// // Çıktı:
// // "Auth modülü kodu: queued → sending"
// // "Auth modülü kodu: sending → waiting_response"
// // "Auth modülü kodu: waiting_response → completed"
// // "DB şeması oluştur: queued → sending"
// // ...
