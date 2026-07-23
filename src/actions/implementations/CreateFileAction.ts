import * as fs from 'fs';
import * as path from 'path';
import { IAction } from '../core/IAction';
import { ActionResult } from '../shared/actionTypes';

export class CreateFileAction implements IAction {
    public validate(payload: any): boolean {
        return !!payload.path || !!payload.filePath;
    }

    public async execute(payload: any, workspaceRoot: string): Promise<ActionResult> {
        const targetPath = payload.path || payload.filePath;
        const absolutePath = path.isAbsolute(targetPath) ? targetPath : path.join(workspaceRoot, targetPath);
        const dir = path.dirname(absolutePath);
        
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(absolutePath, payload.content || '', 'utf-8');
        
        return {
            success: true,
            output: `Dosya başarıyla oluşturuldu: ${absolutePath}`,
            executedAt: Date.now()
        };
    }
}
