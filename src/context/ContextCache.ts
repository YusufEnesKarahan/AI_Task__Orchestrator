import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import { BuildContextInput, ContextCacheDocument, ContextPackage, ContextSummaryDocument } from './types';

const CONTEXT_SCHEMA_VERSION = 1;
const CACHE_FILE = 'context-cache.json';
const SUMMARY_FILE = 'context-summary.json';

export class ContextCache {
    private readonly aiosDir: string;

    constructor(private readonly workspaceRoot: string) {
        this.aiosDir = path.join(workspaceRoot, '.aios');
    }

    public async get(cacheKey: string, sourceFingerprint: string): Promise<ContextPackage | undefined> {
        const cache = await this.loadCache();
        return cache.entries.find((entry) => entry.key === cacheKey && entry.sourceFingerprint === sourceFingerprint)
            ?.context;
    }

    public async set(cacheKey: string, sourceFingerprint: string, context: ContextPackage): Promise<void> {
        const now = Date.now();
        const cache = await this.loadCache();
        const entries = cache.entries.filter((entry) => entry.key !== cacheKey);
        entries.unshift({
            key: cacheKey,
            createdAt: now,
            sourceFingerprint,
            context
        });

        const nextCache: ContextCacheDocument = {
            schemaVersion: CONTEXT_SCHEMA_VERSION,
            createdAt: cache.createdAt,
            updatedAt: now,
            entries: entries.slice(0, 25)
        };

        await this.writeJson(CACHE_FILE, nextCache);
        await this.writeSummary({
            schemaVersion: CONTEXT_SCHEMA_VERSION,
            updatedAt: now,
            lastContextId: context.id,
            cacheEntries: nextCache.entries.length,
            lastBudget: context.budget,
            lastAgent: context.agent,
            lastTaskType: context.taskType,
            lastTokenEstimate: context.tokenEstimate
        });
    }

    public async clear(): Promise<void> {
        const now = Date.now();
        await this.writeJson(CACHE_FILE, {
            schemaVersion: CONTEXT_SCHEMA_VERSION,
            createdAt: now,
            updatedAt: now,
            entries: []
        } satisfies ContextCacheDocument);
        await this.writeSummary({
            schemaVersion: CONTEXT_SCHEMA_VERSION,
            updatedAt: now,
            cacheEntries: 0
        });
    }

    public createCacheKey(input: BuildContextInput): string {
        return crypto
            .createHash('sha256')
            .update(
                JSON.stringify({
                    task: input.task || null,
                    agent: input.agent || 'planner',
                    budget: input.budget || 'medium',
                    query: input.query || ''
                })
            )
            .digest('hex');
    }

    public createSourceFingerprint(parts: unknown[]): string {
        return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
    }

    private async loadCache(): Promise<ContextCacheDocument> {
        await fs.mkdir(this.aiosDir, { recursive: true });
        const filePath = path.join(this.aiosDir, CACHE_FILE);
        const now = Date.now();

        if (!existsSync(filePath)) {
            return {
                schemaVersion: CONTEXT_SCHEMA_VERSION,
                createdAt: now,
                updatedAt: now,
                entries: []
            };
        }

        try {
            const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as Partial<ContextCacheDocument>;
            return {
                schemaVersion: CONTEXT_SCHEMA_VERSION,
                createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : now,
                updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : now,
                entries: Array.isArray(parsed.entries) ? parsed.entries : []
            };
        } catch {
            return {
                schemaVersion: CONTEXT_SCHEMA_VERSION,
                createdAt: now,
                updatedAt: now,
                entries: []
            };
        }
    }

    private async writeSummary(summary: ContextSummaryDocument): Promise<void> {
        await this.writeJson(SUMMARY_FILE, summary);
    }

    private async writeJson(fileName: string, value: unknown): Promise<void> {
        await fs.mkdir(this.aiosDir, { recursive: true });
        await fs.writeFile(path.join(this.aiosDir, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    }
}
