import { EntityId, Timestamp } from './index';
import type { TargetAgent } from '../orchestrator/templates/PromptTemplates';

// ---------------------------------------------------------------------------
// Prompt Yaşam Döngüsü (Lifecycle)
// ---------------------------------------------------------------------------

export type PromptStatus =
    | 'draft' // Üretildi, henüz incelenmedi
    | 'approved' // Kullanıcı onayladı, yürütme kuyruğuna eklenebilir
    | 'rejected' // Kullanıcı reddetti, yürütülmeyecek
    | 'queued' // Yürütme kuyruğunda sıra bekliyor
    | 'sending' // AI provider'a istek atılıyor
    | 'waiting_response' // İstek atıldı, yanıt bekleniyor
    | 'completed' // AI yanıtı başarıyla alındı
    | 'failed' // AI isteği veya işleme sırasında hata oluştu
    | 'cancelled' // Kullanıcı kuyruktan iptal etti
    // Manual/External Modları
    | 'ready_for_manual_send'
    | 'sent_manually'
    | 'awaiting_manual_result'
    | 'manually_completed';

// ---------------------------------------------------------------------------
// Yürütme Modu (Execution Mode)
// ---------------------------------------------------------------------------

export type PromptExecutionMode =
    | 'internal_ai' // Sistem kendi AI provider'ını kullanarak yürütür
    | 'external_chat_placeholder' // Kullanıcı promptu harici bir chat'e yapıştıracak
    | 'manual'; // Tamamen manuel; sistem sadece kaydeder

// ---------------------------------------------------------------------------
// Execution Result
// ---------------------------------------------------------------------------

export interface PromptExecutionResult {
    rawResponse?: string;
    parsedSummary?: string;
    executionStart?: number;
    executionEnd?: number;
    durationMs?: number;
    errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Prompt Entity
// ---------------------------------------------------------------------------

export interface Prompt {
    id: EntityId;
    taskId: EntityId;

    /** Kullanıcıya gösterilecek kısa başlık (genelde task title'dan türetilir) */
    title: string;

    /** AI'a gönderilen system prompt */
    systemPrompt: string;

    /** AI'a gönderilen kullanıcı prompt içeriği */
    content: string;

    /** Prompt şablonunun adı (Örn: "Code Generation", "Bug Fix") */
    templateName?: string;
    targetAgent?: TargetAgent;

    status: PromptStatus;
    executionMode: PromptExecutionMode;

    /** Hangi AI sağlayıcısıyla yürütüldü (Örn: "OpenAI", "Gemini", "Mock") */
    provider?: string;

    /** AI'dan dönen yanıt metni */
    responseText?: string;

    /** Hata oluştuysa açıklaması */
    errorMessage?: string;

    /** Detaylı yürütme (execution) metrikleri ve ham veriler */
    executionResult?: PromptExecutionResult;

    /** Kuyruktaki sırası (task.order ile başlatılır) */
    order: number;

    // --- Zaman Damgaları ---
    createdAt: Timestamp;
    updatedAt: Timestamp;
    approvedAt?: Timestamp;
    sentAt?: Timestamp;
    completedAt?: Timestamp;
}

// ---------------------------------------------------------------------------
// Yardımcı Tipler
// ---------------------------------------------------------------------------

/** Prompt oluşturma fonksiyonları için girdi */
export interface CreatePromptInput {
    taskId: EntityId;
    title: string;
    systemPrompt: string;
    content: string;
    templateName?: string;
    targetAgent?: TargetAgent;
    order: number;
    executionMode?: PromptExecutionMode;
}

/** Status geçiş kontrolleri için izin verilen akışlar */
export const PROMPT_STATUS_TRANSITIONS: Record<PromptStatus, PromptStatus[]> = {
    draft: ['approved', 'rejected', 'cancelled'],
    approved: ['queued', 'rejected', 'cancelled'],
    rejected: ['draft'], // Yeniden düzenleme için geri alınabilir
    queued: ['sending', 'ready_for_manual_send', 'cancelled'],
    sending: ['waiting_response', 'failed', 'cancelled'],
    waiting_response: ['completed', 'failed', 'cancelled'],
    completed: [], // Son durum
    failed: ['approved', 'queued', 'draft'], // Tekrar deneme veya düzenleme
    cancelled: ['draft'], // İptalden geri alınabilir
    // Manual Status Geçişleri
    ready_for_manual_send: ['sent_manually', 'manually_completed', 'cancelled', 'failed'],
    sent_manually: ['awaiting_manual_result', 'manually_completed', 'cancelled', 'failed'],
    awaiting_manual_result: ['manually_completed', 'failed', 'cancelled'],
    manually_completed: []
};

/**
 * Verilen geçişin kurallara uygun olup olmadığını kontrol eder.
 */
export function isValidTransition(from: PromptStatus, to: PromptStatus): boolean {
    return PROMPT_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Yeni bir Prompt nesnesi oluşturan fabrika fonksiyonu.
 */
export function createPrompt(input: CreatePromptInput): Prompt {
    const now = Date.now();
    return {
        id: `prompt_${now}_${Math.floor(Math.random() * 10000)}`,
        taskId: input.taskId,
        title: input.title,
        systemPrompt: input.systemPrompt,
        content: input.content,
        templateName: input.templateName,
        targetAgent: input.targetAgent,
        status: 'draft',
        executionMode: input.executionMode || 'manual',
        order: input.order,
        createdAt: now,
        updatedAt: now
    };
}
