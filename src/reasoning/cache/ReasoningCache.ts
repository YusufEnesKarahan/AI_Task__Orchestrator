import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ContextPackage } from '../../context/types';
import { ReasoningCacheDocument, ReasoningResult } from '../shared/reasoningTypes';

export class ReasoningCache {
    private readonly cachePath: string;

    constructor(workspaceRoot: string) {
        this.cachePath = path.join(workspaceRoot, '.aios', 'reasoning', 'reasoning-cache.json');
        this.ensureDirExists();
    }

    private ensureDirExists() {
        const dir = path.dirname(this.cachePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * Parmak izi üretir: Task, Context Hash, Memory Version, Knowledge Version
     */
    public generateFingerprint(taskDescription: string, context?: ContextPackage): string {
        const hash = crypto.createHash('sha256');
        
        // 1. Task Description
        hash.update(taskDescription);

        // 2. Context Hash / Key
        if (context?.cacheKey) {
            hash.update(context.cacheKey);
        }

        // 3. Memory Version
        if (context?.memory) {
            const memoryVer = `${context.memory.currentSprint || ''}_${context.memory.currentGoal || ''}_${context.memory.currentTask || ''}`;
            hash.update(memoryVer);
        }

        // 4. Knowledge Version
        if (context?.knowledge) {
            const knowledgeVer = (context.knowledge.technologies || []).join(',') + 
                                 (context.knowledge.modules || []).join(',');
            hash.update(knowledgeVer);
        }

        return hash.digest('hex');
    }

    /**
     * Cache'ten kayıt çeker.
     */
    public get(fingerprint: string): ReasoningResult | null {
        const doc = this.loadCache();
        const entry = doc.entries.find(e => e.fingerprint === fingerprint);
        if (entry) {
            return entry.result;
        }
        return null;
    }

    /**
     * Cache'e yeni kayıt yazar.
     */
    public set(fingerprint: string, result: ReasoningResult): void {
        const doc = this.loadCache();
        
        // Varsa eskiyi kaldır, yeniyi ekle
        const filteredEntries = doc.entries.filter(e => e.fingerprint !== fingerprint);
        filteredEntries.push({
            fingerprint,
            createdAt: Date.now(),
            result: {
                ...result,
                fromCache: true // Cache'ten dönüldüğünü işaretle
            }
        });

        doc.entries = filteredEntries;
        doc.updatedAt = Date.now();
        
        this.saveCache(doc);
    }

    /**
     * Cache'i temizler.
     */
    public clear(): void {
        const emptyDoc: ReasoningCacheDocument = {
            schemaVersion: 1,
            updatedAt: Date.now(),
            entries: []
        };
        this.saveCache(emptyDoc);
    }

    private loadCache(): ReasoningCacheDocument {
        if (!fs.existsSync(this.cachePath)) {
            return {
                schemaVersion: 1,
                updatedAt: Date.now(),
                entries: []
            };
        }
        try {
            const data = fs.readFileSync(this.cachePath, 'utf-8');
            return JSON.parse(data) as ReasoningCacheDocument;
        } catch (error) {
            console.error('[ReasoningCache] Error reading cache file:', error);
            return {
                schemaVersion: 1,
                updatedAt: Date.now(),
                entries: []
            };
        }
    }

    private saveCache(doc: ReasoningCacheDocument): void {
        fs.writeFileSync(this.cachePath, JSON.stringify(doc, null, 2), 'utf-8');
    }
}
