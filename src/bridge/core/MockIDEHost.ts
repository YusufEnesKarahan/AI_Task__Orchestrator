import * as fs from 'fs';
import * as path from 'path';
import { IIDEHost } from './IIDEHost';
import { ActiveEditorInfo, SelectionInfo, DiagnosticInfo, WorkspaceInfo } from '../shared/bridgeTypes';

export class MockIDEHost implements IIDEHost {
    private mockEditor: ActiveEditorInfo | undefined;
    private mockSelection: SelectionInfo | undefined;
    private mockDiagnostics: DiagnosticInfo[] = [];
    private readonly commandHandlers = new Map<string, (...args: any[]) => Promise<any>>();
    private watcher: fs.FSWatcher | undefined;

    constructor(private readonly workspaceRoot: string) {}

    public setMockEditor(editor: ActiveEditorInfo | undefined) {
        this.mockEditor = editor;
    }

    public setMockSelection(selection: SelectionInfo | undefined) {
        this.mockSelection = selection;
    }

    public setMockDiagnostics(diagnostics: DiagnosticInfo[]) {
        this.mockDiagnostics = diagnostics;
    }

    public registerMockCommand(command: string, handler: (...args: any[]) => Promise<any>) {
        this.commandHandlers.set(command, handler);
    }

    public getActiveEditor(): ActiveEditorInfo | undefined {
        return this.mockEditor;
    }

    public getWorkspace(): WorkspaceInfo {
        return {
            workspaceRoot: this.workspaceRoot,
            folders: [this.workspaceRoot]
        };
    }

    public getSelection(): SelectionInfo | undefined {
        return this.mockSelection;
    }

    public async executeCommand(command: string, ...args: any[]): Promise<any> {
        const handler = this.commandHandlers.get(command);
        if (handler) {
            return handler(...args);
        }
        return `Mock command executed: ${command}`;
    }

    public showDiagnostics(): DiagnosticInfo[] {
        return this.mockDiagnostics;
    }

    public watchWorkspace(onChanged: (filePath: string) => void): void {
        if (fs.existsSync(this.workspaceRoot)) {
            try {
                this.watcher = fs.watch(this.workspaceRoot, { recursive: true }, (event, filename) => {
                    if (filename) {
                        onChanged(path.join(this.workspaceRoot, filename));
                    }
                });
            } catch (err) {
                // Ignore watcher errors in some environments
            }
        }
    }

    public dispose() {
        if (this.watcher) {
            this.watcher.close();
        }
    }
}
