import * as fs from 'fs/promises';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Workspace Scan Sonucu
// ---------------------------------------------------------------------------

export interface WorkspaceScanResult {
    /** Workspace kök dizin adı */
    name: string;
    /** Güvenli kısaltılmış yol (son 2 segment) */
    shortPath: string;
    /** package.json var mı? */
    hasPackageJson: boolean;
    /** README.md var mı? */
    hasReadme: boolean;
    /** src/ klasörü var mı? */
    hasSrcDir: boolean;
    /** Tespit edilen teknoloji etiketleri */
    stackTags: string[];
    /** Yaklaşık dosya sayısı (dışlanan klasörler hariç) */
    approxFileCount: number;
    /** Tarama zamanı */
    scannedAt: number;
}

// ---------------------------------------------------------------------------
// Dışlanacak Klasörler
// ---------------------------------------------------------------------------

const EXCLUDED_DIRS = new Set([
    'node_modules',
    '.git',
    'out',
    'out-test',
    'dist',
    'build',
    'coverage',
    '.next',
    '.nuxt',
    '.vscode',
    '__pycache__',
    '.cache',
    '.turbo'
]);

// ---------------------------------------------------------------------------
// Teknoloji Tanıma Kuralları
// ---------------------------------------------------------------------------

interface StackRule {
    tag: string;
    check: (deps: Record<string, string>) => boolean;
}

const STACK_RULES: StackRule[] = [
    { tag: 'TypeScript', check: (d) => 'typescript' in d },
    { tag: 'React', check: (d) => 'react' in d && !('react-native' in d) },
    { tag: 'React Native', check: (d) => 'react-native' in d },
    { tag: 'Expo', check: (d) => 'expo' in d },
    { tag: 'Next.js', check: (d) => 'next' in d },
    { tag: 'Vue', check: (d) => 'vue' in d },
    { tag: 'Angular', check: (d) => '@angular/core' in d },
    { tag: 'Express', check: (d) => 'express' in d },
    { tag: 'Fastify', check: (d) => 'fastify' in d },
    { tag: 'Firebase', check: (d) => 'firebase' in d || 'firebase-admin' in d },
    { tag: 'Zod', check: (d) => 'zod' in d },
    { tag: 'Prisma', check: (d) => '@prisma/client' in d || 'prisma' in d },
    { tag: 'Jest', check: (d) => 'jest' in d },
    { tag: 'Vitest', check: (d) => 'vitest' in d },
    { tag: 'ESLint', check: (d) => 'eslint' in d },
    { tag: 'Prettier', check: (d) => 'prettier' in d },
    {
        tag: 'VS Code Extension',
        check: (d) => '@types/vscode' in d || 'vscode' in d || '@vscode/vsce' in d
    },
    { tag: 'Electron', check: (d) => 'electron' in d },
    { tag: 'Tailwind CSS', check: (d) => 'tailwindcss' in d }
];

// ---------------------------------------------------------------------------
// WorkspaceScanner
// ---------------------------------------------------------------------------

export class WorkspaceScanner {
    constructor(private readonly workspaceRoot: string) {}

    /**
     * Workspace'i tarar ve temel metadata toplar.
     * Dosya içeriklerini AI'a göndermez — sadece local metadata.
     */
    public async scan(): Promise<WorkspaceScanResult> {
        const rootName = path.basename(this.workspaceRoot);
        const shortPath = this.workspaceRoot.split(/[\\/]/).slice(-2).join('/');

        const [hasPackageJson, hasReadme, hasSrcDir] = await Promise.all([
            this.fileExists('package.json'),
            this.fileExists('README.md'),
            this.dirExists('src')
        ]);

        let stackTags: string[] = [];
        if (hasPackageJson) {
            stackTags = await this.detectStack();
        }

        const approxFileCount = await this.countFiles(this.workspaceRoot, 0, 3);

        return {
            name: rootName,
            shortPath,
            hasPackageJson,
            hasReadme,
            hasSrcDir,
            stackTags,
            approxFileCount,
            scannedAt: Date.now()
        };
    }

    /**
     * package.json dependencies + devDependencies üzerinden teknoloji tahmini yapar.
     */
    private async detectStack(): Promise<string[]> {
        try {
            const pkgPath = path.resolve(this.workspaceRoot, 'package.json');
            const content = await fs.readFile(pkgPath, 'utf8');
            const pkg = JSON.parse(content);

            const allDeps: Record<string, string> = {
                ...(pkg.dependencies || {}),
                ...(pkg.devDependencies || {})
            };

            return STACK_RULES.filter((rule) => rule.check(allDeps)).map((rule) => rule.tag);
        } catch {
            return [];
        }
    }

    /**
     * Workspace içindeki dosya sayısını güvenli biçimde sayar.
     * Dışlanan klasörleri atlar. Belirli derinliğe kadar iner.
     */
    private async countFiles(dir: string, currentDepth: number, maxDepth: number): Promise<number> {
        if (currentDepth > maxDepth) {
            return 0;
        }

        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            let count = 0;

            for (const entry of entries) {
                if (entry.name.startsWith('.') && currentDepth === 0 && entry.isDirectory()) {
                    continue; // Kök seviyede gizli klasörleri atla
                }

                if (entry.isDirectory()) {
                    if (EXCLUDED_DIRS.has(entry.name)) {
                        continue;
                    }
                    count += await this.countFiles(path.join(dir, entry.name), currentDepth + 1, maxDepth);
                } else {
                    count += 1;
                }
            }

            return count;
        } catch {
            return 0;
        }
    }

    private async fileExists(relativePath: string): Promise<boolean> {
        try {
            const fullPath = path.resolve(this.workspaceRoot, relativePath);
            const stat = await fs.stat(fullPath);
            return stat.isFile();
        } catch {
            return false;
        }
    }

    private async dirExists(relativePath: string): Promise<boolean> {
        try {
            const fullPath = path.resolve(this.workspaceRoot, relativePath);
            const stat = await fs.stat(fullPath);
            return stat.isDirectory();
        } catch {
            return false;
        }
    }
}
