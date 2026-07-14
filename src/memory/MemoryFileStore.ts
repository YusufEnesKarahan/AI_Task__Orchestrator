import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { MemoryDocumentBase } from './types';

type Normalizer<T> = (value: Partial<T> | undefined, now: number) => T;

export class MemoryFileStore {
    private readonly aiosDir: string;

    constructor(private readonly workspaceRoot: string) {
        this.aiosDir = path.join(workspaceRoot, '.aios');
    }

    public getAiosDir(): string {
        return this.aiosDir;
    }

    public getFilePath(fileName: string): string {
        return path.join(this.aiosDir, fileName);
    }

    public async readDocument<T extends MemoryDocumentBase>(
        fileName: string,
        createDefault: (now: number) => T,
        normalize: Normalizer<T>
    ): Promise<{ document: T; healed: boolean }> {
        await this.ensureAiosDir();
        const filePath = this.getFilePath(fileName);
        const now = Date.now();

        if (!existsSync(filePath)) {
            return { document: createDefault(now), healed: true };
        }

        try {
            const content = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(content) as Partial<T>;
            const document = normalize(parsed, now);
            const healed = JSON.stringify(parsed) !== JSON.stringify(document);
            return { document, healed };
        } catch {
            return { document: createDefault(now), healed: true };
        }
    }

    public async writeDocument<T extends MemoryDocumentBase>(fileName: string, document: T): Promise<void> {
        await this.ensureAiosDir();
        await fs.writeFile(this.getFilePath(fileName), `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    }

    public async removeDocument(fileName: string): Promise<void> {
        try {
            await fs.unlink(this.getFilePath(fileName));
        } catch {
            // Missing memory files are treated as already cleared.
        }
    }

    private async ensureAiosDir(): Promise<void> {
        await fs.mkdir(this.aiosDir, { recursive: true });
    }
}
