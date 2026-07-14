import * as path from 'path';
import { FolderStructureNode, IProjectAnalyzer } from '../shared/intelligenceTypes';

export class ProjectStructureAnalyzer implements IProjectAnalyzer {
    public async analyze(workspaceRoot: string, filePaths: string[]): Promise<FolderStructureNode[]> {
        const rootNode: FolderStructureNode = {
            path: '.',
            type: 'directory',
            children: []
        };

        const nodeMap = new Map<string, FolderStructureNode>();
        nodeMap.set('.', rootNode);

        for (const filePath of filePaths) {
            const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
            const parts = relativePath.split('/');
            let currentPath = '';

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const parentPath = currentPath || '.';
                currentPath = currentPath ? `${currentPath}/${part}` : part;

                if (!nodeMap.has(currentPath)) {
                    const isLast = i === parts.length - 1;
                    const node: FolderStructureNode = {
                        path: currentPath,
                        type: isLast ? 'file' : 'directory',
                        children: isLast ? undefined : []
                    };

                    node.role = this.inferRole(currentPath, node.type);
                    nodeMap.set(currentPath, node);

                    const parentNode = nodeMap.get(parentPath);
                    if (parentNode && parentNode.children) {
                        parentNode.children.push(node);
                    }
                }
            }
        }

        return rootNode.children || [];
    }

    private inferRole(filePath: string, type: 'directory' | 'file'): string | undefined {
        const parts = filePath.toLowerCase().split('/');
        const fileName = parts[parts.length - 1];

        // Dizin rollerini tahmin et
        if (type === 'directory') {
            if (parts.includes('frontend') || parts.includes('client') || parts.includes('webview-ui'))
                return 'Frontend';
            if (parts.includes('backend') || parts.includes('server') || parts.includes('api')) return 'Backend';
            if (parts.includes('components')) return 'Components';
            if (parts.includes('pages') || parts.includes('views')) return 'Pages';
            if (parts.includes('layouts')) return 'Layouts';
            if (parts.includes('hooks')) return 'Hooks';
            if (parts.includes('utils') || parts.includes('helpers')) return 'Utils';
            if (parts.includes('services') || parts.includes('providers')) return 'Services';
            if (parts.includes('repositories')) return 'Repositories';
            if (parts.includes('controllers')) return 'Controllers';
            if (parts.includes('models')) return 'Models';
            if (parts.includes('policies') || parts.includes('guards')) return 'Policies';
            if (parts.includes('middlewares')) return 'Middlewares';
            if (parts.includes('routes')) return 'Routes';
            if (parts.includes('database') || parts.includes('migrations')) return 'Database';
            if (parts.includes('config')) return 'Config';
            if (parts.includes('tests') || parts.includes('test') || parts.includes('__tests__')) return 'Tests';
            if (parts.includes('scripts')) return 'Scripts';
            if (parts.includes('assets') || parts.includes('public') || parts.includes('resources')) return 'Assets';
            if (parts.includes('shared') || parts.includes('common')) return 'Shared';
            if (parts.includes('infrastructure') || parts.includes('infra')) return 'Infrastructure';
            return undefined;
        }

        // Dosya rollerini uzantı veya ada göre tahmin et
        if (fileName.includes('.test.') || fileName.includes('.spec.')) return 'Tests';
        if (fileName === 'package.json' || fileName === 'tsconfig.json') return 'Config';
        if (fileName.endsWith('.css') || fileName.endsWith('.scss')) return 'Assets';
        if (fileName.endsWith('.sh') || fileName.endsWith('.ps1') || fileName.endsWith('.bat')) return 'Scripts';
        return undefined;
    }
}
