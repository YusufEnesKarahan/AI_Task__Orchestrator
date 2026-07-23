import { exec } from 'child_process';
import { IAction } from '../core/IAction';
import { ActionResult } from '../shared/actionTypes';

export class RunCommandAction implements IAction {
    public validate(payload: any): boolean {
        return !!payload.command;
    }

    public async execute(payload: any, workspaceRoot: string): Promise<ActionResult> {
        const cwd = payload.cwd || workspaceRoot;
        
        return new Promise<ActionResult>((resolve) => {
            exec(payload.command, { cwd }, (error, stdout, stderr) => {
                if (error) {
                    resolve({
                        success: false,
                        output: stdout,
                        error: stderr || error.message,
                        executedAt: Date.now()
                    });
                } else {
                    resolve({
                        success: true,
                        output: stdout || stderr,
                        executedAt: Date.now()
                    });
                }
            });
        });
    }
}
