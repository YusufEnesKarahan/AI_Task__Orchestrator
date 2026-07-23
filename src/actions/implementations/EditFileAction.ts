import * as fs from 'fs';
import * as path from 'path';
import { IAction } from '../core/IAction';
import { ActionResult } from '../shared/actionTypes';

export class EditFileAction implements IAction {
    public validate(payload: any): boolean {
        return !!payload.path || !!payload.filePath;
    }

    public async execute(payload: any, workspaceRoot: string): Promise<ActionResult> {
        const targetPath = payload.path || payload.filePath;
        const absolutePath = path.isAbsolute(targetPath) ? targetPath : path.join(workspaceRoot, targetPath);
        
        fs.writeFileSync(absolutePath, payload.content || '', 'utf-8');
        
        return {
            success: true,
            output: `Dosya başarıyla güncellendi: ${absolutePath}`,
            executedAt: Date.now()
        };
    }
}
