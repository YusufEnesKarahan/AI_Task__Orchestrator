import { ActionType } from '../shared/actionTypes';
import { IAction } from './IAction';
import { CreateFileAction } from '../implementations/CreateFileAction';
import { EditFileAction } from '../implementations/EditFileAction';
import { DeleteFileAction } from '../implementations/DeleteFileAction';
import { RenameFileAction } from '../implementations/RenameFileAction';
import { CreateFolderAction } from '../implementations/CreateFolderAction';
import { MoveFileAction } from '../implementations/MoveFileAction';
import { ApplyPatchAction } from '../implementations/ApplyPatchAction';
import { RunCommandAction } from '../implementations/RunCommandAction';

export class ActionRegistry {
    private static instance: ActionRegistry;
    private readonly actions = new Map<ActionType, IAction>();

    private constructor() {
        this.registerDefaults();
    }

    public static getInstance(): ActionRegistry {
        if (!ActionRegistry.instance) {
            ActionRegistry.instance = new ActionRegistry();
        }
        return ActionRegistry.instance;
    }

    /**
     * Eylem sınıfını kaydeder.
     */
    public register(type: ActionType, action: IAction): void {
        this.actions.set(type, action);
    }

    /**
     * Eylem sınıfını döndürür.
     */
    public getAction(type: ActionType): IAction | undefined {
        return this.actions.get(type);
    }

    private registerDefaults() {
        this.register('create_file', new CreateFileAction());
        this.register('edit_file', new EditFileAction());
        this.register('delete_file', new DeleteFileAction());
        this.register('rename_file', new RenameFileAction());
        this.register('create_folder', new CreateFolderAction());
        this.register('move_file', new MoveFileAction());
        this.register('apply_patch', new ApplyPatchAction());
        this.register('run_command', new RunCommandAction());
    }
}
