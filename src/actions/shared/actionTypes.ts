export type ActionType =
    | 'create_file'
    | 'edit_file'
    | 'delete_file'
    | 'rename_file'
    | 'create_folder'
    | 'move_file'
    | 'apply_patch'
    | 'run_command';

export interface ActionDefinition {
    type: ActionType;
    payload: Record<string, any>;
}

export interface ActionResult {
    success: boolean;
    output?: string;
    error?: string;
    executedAt: number;
}

export interface TransactionResult {
    transactionId: string;
    success: boolean;
    results: ActionResult[];
    rolledBack: boolean;
    rollbackError?: string;
}

export interface WorkspaceBackup {
    filePath: string;
    content: string | null; // null means file did not exist (was created)
}
