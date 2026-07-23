import * as fs from 'fs';
import * as path from 'path';
import { IAction } from '../core/IAction';
import { ActionResult } from '../shared/actionTypes';

export class RenameFileAction implements IAction {
    public validate(payload: any): boolean {
        return (!!payload.oldPath || !!payload.path) && !!payload.newPath;
    }

    public async execute(payload: any, workspaceRoot: string): Promise<ActionResult> {
        const oldP = payload.oldPath || payload.path;
        const absoluteOld = path.isAbsolute(oldP) ? oldP : path.join(workspaceRoot, oldP);
        const absoluteNew = path.isAbsolute(payload.newPath) ? payload.newPath : path.join(workspaceRoot, payload.newPath);

        const dir = path.dirname(absoluteNew);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (fs.existsSync(absoluteOld)) {
            fs.renameSync(absoluteOld, absoluteNew);
        } else {
            throw new Error(`Yeniden adlandırılacak kaynak dosya bulunamadı: ${absoluteOld}`);
        }

        return {
            success: true,
            output: `Dosya yeniden adlandırıldı: ${absoluteOld} -> ${absoluteNew}`,
            executedAt: Date.now()
        };
    }
}
