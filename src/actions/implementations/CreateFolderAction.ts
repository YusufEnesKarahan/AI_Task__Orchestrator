import * as fs from 'fs';
import * as path from 'path';
import { IAction } from '../core/IAction';
import { ActionResult } from '../shared/actionTypes';

export class CreateFolderAction implements IAction {
    public validate(payload: any): boolean {
        return !!payload.path || !!payload.folderPath;
    }

    public async execute(payload: any, workspaceRoot: string): Promise<ActionResult> {
        const targetPath = payload.path || payload.folderPath;
        const absolutePath = path.isAbsolute(targetPath) ? targetPath : path.join(workspaceRoot, targetPath);
        
        if (!fs.existsSync(absolutePath)) {
            fs.mkdirSync(absolutePath, { recursive: true });
        }
        
        return {
            success: true,
            output: `Klasör başarıyla oluşturuldu: ${absolutePath}`,
            executedAt: Date.now()
        };
    }
}
