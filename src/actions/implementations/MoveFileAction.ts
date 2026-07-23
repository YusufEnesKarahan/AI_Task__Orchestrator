import * as fs from 'fs';
import * as path from 'path';
import { IAction } from '../core/IAction';
import { ActionResult } from '../shared/actionTypes';

export class MoveFileAction implements IAction {
    public validate(payload: any): boolean {
        return !!payload.from && !!payload.to;
    }

    public async execute(payload: any, workspaceRoot: string): Promise<ActionResult> {
        const absoluteFrom = path.isAbsolute(payload.from) ? payload.from : path.join(workspaceRoot, payload.from);
        const absoluteTo = path.isAbsolute(payload.to) ? payload.to : path.join(workspaceRoot, payload.to);

        const dir = path.dirname(absoluteTo);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (fs.existsSync(absoluteFrom)) {
            fs.renameSync(absoluteFrom, absoluteTo);
        } else {
            throw new Error(`Taşınacak kaynak dosya bulunamadı: ${absoluteFrom}`);
        }

        return {
            success: true,
            output: `Dosya taşındı: ${absoluteFrom} -> ${absoluteTo}`,
            executedAt: Date.now()
        };
    }
}
