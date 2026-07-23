import { ActionResult } from '../shared/actionTypes';

export interface IAction {
    /**
     * Eylemin girdilerini doğrular.
     */
    validate(payload: any): boolean;

    /**
     * Eylemi dosya sisteminde veya işletim sisteminde yürütür.
     */
    execute(payload: any, workspaceRoot: string): Promise<ActionResult>;
}
