import * as path from 'path';
import { RawTask } from '../shared/taskTypes';

export class TaskParser {
    /**
     * Markdown TODO listelerini ayrıştırır.
     * Örnek satır: - [ ] Görev Başlığı (#bagimli-is)
     */
    public parseMarkdown(content: string): RawTask[] {
        const tasks: RawTask[] = [];
        const lines = content.split('\n');

        for (const line of lines) {
            const match = line.match(/-\s*\[\s*\]\s*([^#(\n\r]+)(?:\s*(?:\(#([^)]+)\)|#(\S+)))?/);
            if (match) {
                const title = match[1].trim();
                const dep = match[2] || match[3];
                const dependencies = dep ? [dep.trim()] : [];

                tasks.push({
                    title,
                    description: `Markdown TODO item: ${title}`,
                    dependencies
                });
            }
        }
        return tasks;
    }

    /**
     * Kod dosyalarındaki // TODO veya // FIXME yorumlarını yakalar.
     */
    public parseCodeComments(filePath: string, fileContent: string): RawTask[] {
        const tasks: RawTask[] = [];
        const lines = fileContent.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(/(?:\/\/|\/\*|#)\s*(TODO|FIXME)\s*:\s*(.+)/i);
            if (match) {
                const type = match[1].toUpperCase();
                const title = match[2].replace(/\*\/$/, '').trim();

                tasks.push({
                    title,
                    description: `${type} comment in ${path.basename(filePath)} at line ${i + 1}`,
                    filePath,
                    line: i + 1,
                    type: type === 'FIXME' ? 'bug' : undefined
                });
            }
        }
        return tasks;
    }

    /**
     * GitHub Issue verisini ayrıştırır.
     */
    public parseGitHubIssue(issueJson: string): RawTask {
        try {
            const data = JSON.parse(issueJson);
            const labels = Array.isArray(data.labels) 
                ? data.labels.map((l: any) => typeof l === 'object' ? l.name : String(l))
                : [];
            return {
                title: data.title || 'Untitled Issue',
                description: data.body || '',
                labels
            };
        } catch {
            throw new Error('GitHub Issue JSON formatı geçersiz.');
        }
    }

    /**
     * JSON listelerini ayrıştırır.
     */
    public parseJsonList(jsonStr: string): RawTask[] {
        try {
            const data = JSON.parse(jsonStr);
            const list = Array.isArray(data) ? data : [data];
            return list.map((item: any) => ({
                title: item.title || 'Untitled JSON Task',
                description: item.description || '',
                labels: item.labels || [],
                dependencies: item.dependencies || []
            }));
        } catch {
            throw new Error('JSON Task listesi formatı geçersiz.');
        }
    }
}
