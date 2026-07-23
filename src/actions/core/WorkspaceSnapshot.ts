import * as fs from 'fs';
import * as path from 'path';
import { ActionDefinition, WorkspaceBackup } from '../shared/actionTypes';

export class WorkspaceSnapshot {
    private readonly backups = new Map<string, WorkspaceBackup>();

    constructor(private readonly workspaceRoot: string) {}

    /**
     * Yürütülecek eylemlerin etkileyeceği tüm dosyaların yedeklerini alır.
     */
    public takeSnapshot(actions: ActionDefinition[]): void {
        const filePaths = this.extractFilePaths(actions);

        for (const filePath of filePaths) {
            const absolutePath = path.isAbsolute(filePath) 
                ? filePath 
                : path.join(this.workspaceRoot, filePath);

            if (fs.existsSync(absolutePath)) {
                try {
                    const content = fs.readFileSync(absolutePath, 'utf-8');
                    this.backups.set(absolutePath, {
                        filePath: absolutePath,
                        content
                    });
                } catch (error) {
                    console.error(`[WorkspaceSnapshot] Error reading backup for ${absolutePath}:`, error);
                }
            } else {
                // Dosya yoksa, rollback aşamasında silinmek üzere içeriği null olarak işaretleriz
                this.backups.set(absolutePath, {
                    filePath: absolutePath,
                    content: null
                });
            }
        }
    }

    /**
     * Tüm yedekleri dizi halinde döner.
     */
    public getBackups(): WorkspaceBackup[] {
        return Array.from(this.backups.values());
    }

    /**
     * Belirli bir dosyanın yedeğini çeker.
     */
    public getBackup(absolutePath: string): WorkspaceBackup | undefined {
        return this.backups.get(absolutePath);
    }

    /**
     * Eylem tiplerine göre etkilenecek dosya yollarını ayıklar.
     */
    private extractFilePaths(actions: ActionDefinition[]): Set<string> {
        const paths = new Set<string>();

        for (const action of actions) {
            const p = action.payload;
            if (!p) continue;

            switch (action.type) {
                case 'create_file':
                case 'edit_file':
                case 'delete_file':
                case 'apply_patch':
                    if (p.path) paths.add(p.path);
                    if (p.filePath) paths.add(p.filePath);
                    break;
                
                case 'rename_file':
                    if (p.path) paths.add(p.path);
                    if (p.oldPath) paths.add(p.oldPath);
                    if (p.newPath) paths.add(p.newPath);
                    break;

                case 'move_file':
                    if (p.from) paths.add(p.from);
                    if (p.to) paths.add(p.to);
                    break;
            }
        }

        return paths;
    }
}
