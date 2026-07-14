import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { IProjectAnalyzer, TechnologyInfo } from '../shared/intelligenceTypes';

export class TechnologyAnalyzer implements IProjectAnalyzer {
    public async analyze(workspaceRoot: string, filePaths: string[]): Promise<TechnologyInfo[]> {
        const technologies: TechnologyInfo[] = [];

        // Dil tespiti (Dosya uzantılarına göre)
        const hasTs = filePaths.some((p) => p.endsWith('.ts') || p.endsWith('.tsx'));
        const hasJs = filePaths.some((p) => p.endsWith('.js') || p.endsWith('.jsx'));
        const hasHtml = filePaths.some((p) => p.endsWith('.html'));
        const hasCss = filePaths.some((p) => p.endsWith('.css'));

        if (hasTs) technologies.push({ name: 'TypeScript', confidence: 0.95, type: 'Language' });
        if (hasJs) technologies.push({ name: 'JavaScript', confidence: 0.9, type: 'Language' });
        if (hasHtml) technologies.push({ name: 'HTML', confidence: 0.85, type: 'Language' });
        if (hasCss) technologies.push({ name: 'CSS', confidence: 0.85, type: 'Language' });

        // package.json analizi
        const packageJsonPath = path.join(workspaceRoot, 'package.json');
        if (existsSync(packageJsonPath)) {
            technologies.push({ name: 'NodeJS', confidence: 1.0, type: 'Runtime' });
            technologies.push({ name: 'NPM', confidence: 0.95, type: 'Package Manager' });

            try {
                const content = await fs.readFile(packageJsonPath, 'utf8');
                const pkg = JSON.parse(content);
                const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

                // Frameworks
                if ('react' in deps) technologies.push({ name: 'React', confidence: 1.0, type: 'Framework' });
                if ('next' in deps) technologies.push({ name: 'Next.js', confidence: 1.0, type: 'Framework' });
                if ('vue' in deps) technologies.push({ name: 'Vue', confidence: 1.0, type: 'Framework' });
                if ('@angular/core' in deps) technologies.push({ name: 'Angular', confidence: 1.0, type: 'Framework' });
                if ('express' in deps) technologies.push({ name: 'Express', confidence: 1.0, type: 'Framework' });

                // ORMs
                if ('prisma' in deps || '@prisma/client' in deps)
                    technologies.push({ name: 'Prisma', confidence: 1.0, type: 'ORM' });
                if ('sequelize' in deps) technologies.push({ name: 'Sequelize', confidence: 1.0, type: 'ORM' });
                if ('mongoose' in deps) technologies.push({ name: 'Mongoose', confidence: 1.0, type: 'ORM' });

                // State Management
                if ('redux' in deps || '@reduxjs/toolkit' in deps)
                    technologies.push({ name: 'Redux', confidence: 1.0, type: 'State Management' });
                if ('zustand' in deps)
                    technologies.push({ name: 'Zustand', confidence: 1.0, type: 'State Management' });

                // Testing
                if ('jest' in deps) technologies.push({ name: 'Jest', confidence: 1.0, type: 'Testing' });
                if ('vitest' in deps) technologies.push({ name: 'Vitest', confidence: 1.0, type: 'Testing' });

                // CSS Frameworks
                if ('tailwindcss' in deps)
                    technologies.push({ name: 'Tailwind CSS', confidence: 1.0, type: 'CSS Framework' });

                // Build Tools
                if ('vite' in deps) technologies.push({ name: 'Vite', confidence: 1.0, type: 'Build Tool' });
                if ('webpack' in deps) technologies.push({ name: 'Webpack', confidence: 1.0, type: 'Build Tool' });

                // VS Code Extension
                if ('@types/vscode' in deps)
                    technologies.push({ name: 'VS Code Extension API', confidence: 1.0, type: 'Framework' });
            } catch (e) {
                console.error('Failed to parse package.json for tech scan:', e);
            }
        }

        // Diğer dosya marker'larına göre tespit
        if (existsSync(path.join(workspaceRoot, 'pnpm-lock.yaml'))) {
            technologies.push({ name: 'PNPM', confidence: 1.0, type: 'Package Manager' });
        }
        if (existsSync(path.join(workspaceRoot, 'yarn.lock'))) {
            technologies.push({ name: 'Yarn', confidence: 1.0, type: 'Package Manager' });
        }
        if (existsSync(path.join(workspaceRoot, 'Dockerfile'))) {
            technologies.push({ name: 'Docker', confidence: 1.0, type: 'Container' });
        }
        if (existsSync(path.join(workspaceRoot, '.github', 'workflows'))) {
            technologies.push({ name: 'GitHub Actions', confidence: 0.95, type: 'CI/CD' });
        }

        return technologies;
    }
}
