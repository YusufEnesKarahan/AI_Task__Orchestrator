import * as path from 'path';
import { ActionRegistry } from './ActionRegistry';
import { ActionDefinition } from '../shared/actionTypes';

export class ActionValidator {
    private readonly registry = ActionRegistry.getInstance();

    constructor(private readonly workspaceRoot: string) {}

    /**
     * Eylemin yapısal parametrelerini ve güvenliğini denetler.
     */
    public validate(action: ActionDefinition): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // 1. Kayıtlı eylem doğrulaması
        const impl = this.registry.getAction(action.type);
        if (!impl) {
            errors.push(`Eylem tipi sistemde kayıtlı değil: "${action.type}"`);
            return { valid: false, errors };
        }

        // 2. Yapısal girdi doğrulaması
        if (!impl.validate(action.payload)) {
            errors.push(`"${action.type}" eylemi için girdi parametreleri (payload) doğrulanamadı.`);
        }

        // 3. Path Traversal (çalışma alanından dışarı çıkma) güvenlik denetimi
        this.checkPathSecurity(action, errors);

        return {
            valid: errors.length === 0,
            errors
        };
    }

    private checkPathSecurity(action: ActionDefinition, errors: string[]) {
        const p = action.payload;
        if (!p) return;

        const checkPath = (filePath: string) => {
            const absolutePath = path.isAbsolute(filePath) 
                ? path.normalize(filePath) 
                : path.normalize(path.join(this.workspaceRoot, filePath));

            const normalizedRoot = path.normalize(this.workspaceRoot);
            
            if (!absolutePath.startsWith(normalizedRoot)) {
                errors.push(`Güvenlik Uyarısı: Hedef yol çalışma alanı sınırları dışına çıkıyor: "${filePath}"`);
            }
        };

        switch (action.type) {
            case 'create_file':
            case 'edit_file':
            case 'delete_file':
            case 'create_folder':
            case 'apply_patch':
                if (p.path) checkPath(p.path);
                if (p.filePath) checkPath(p.filePath);
                break;
            
            case 'rename_file':
                if (p.path) checkPath(p.path);
                if (p.oldPath) checkPath(p.oldPath);
                if (p.newPath) checkPath(p.newPath);
                break;

            case 'move_file':
                if (p.from) checkPath(p.from);
                if (p.to) checkPath(p.to);
                break;
        }
    }
}
