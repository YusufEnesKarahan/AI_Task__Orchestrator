import { ActionRegistry } from './ActionRegistry';
import { ActionDefinition, ActionResult } from '../shared/actionTypes';

export class ActionExecutor {
    private readonly registry = ActionRegistry.getInstance();

    constructor(private readonly workspaceRoot: string) {}

    /**
     * Eylemi ilgili sınıfa yönlendirerek yürütür.
     */
    public async execute(action: ActionDefinition): Promise<ActionResult> {
        const impl = this.registry.getAction(action.type);
        if (!impl) {
            throw new Error(`Eylem gerçeklemesi bulunamadı: ${action.type}`);
        }
        return impl.execute(action.payload, this.workspaceRoot);
    }
}
