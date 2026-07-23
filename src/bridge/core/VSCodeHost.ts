import { IIDEHost } from './IIDEHost';
import { ActiveEditorInfo, SelectionInfo, DiagnosticInfo, WorkspaceInfo } from '../shared/bridgeTypes';

export class VSCodeHost implements IIDEHost {
    private get vscode(): any {
        return require('vscode');
    }

    public getActiveEditor(): ActiveEditorInfo | undefined {
        const vscode = this.vscode;
        const editor = vscode.window.activeTextEditor;
        if (!editor) return undefined;
        return {
            filePath: editor.document.fileName,
            content: editor.document.getText(),
            languageId: editor.document.languageId
        };
    }

    public getWorkspace(): WorkspaceInfo {
        const vscode = this.vscode;
        const folders = vscode.workspace.workspaceFolders || [];
        const root = folders[0]?.uri.fsPath || '';
        return {
            workspaceRoot: root,
            folders: folders.map((f: any) => f.uri.fsPath)
        };
    }

    public getSelection(): SelectionInfo | undefined {
        const vscode = this.vscode;
        const editor = vscode.window.activeTextEditor;
        if (!editor) return undefined;
        const sel = editor.selection;
        return {
            text: editor.document.getText(sel),
            startLine: sel.start.line + 1,
            endLine: sel.end.line + 1
        };
    }

    public async executeCommand(command: string, ...args: any[]): Promise<any> {
        const vscode = this.vscode;
        return vscode.commands.executeCommand(command, ...args);
    }

    public showDiagnostics(): DiagnosticInfo[] {
        const vscode = this.vscode;
        const diags = vscode.languages.getDiagnostics();
        const results: DiagnosticInfo[] = [];

        for (const [uri, fileDiags] of diags) {
            for (const diag of fileDiags) {
                let severity: 'error' | 'warning' | 'info' = 'info';
                if (diag.severity === vscode.DiagnosticSeverity.Error) severity = 'error';
                else if (diag.severity === vscode.DiagnosticSeverity.Warning) severity = 'warning';

                results.push({
                    filePath: uri.fsPath,
                    message: diag.message,
                    severity,
                    line: diag.range.start.line + 1
                });
            }
        }
        return results;
    }

    public watchWorkspace(onChanged: (filePath: string) => void): void {
        const vscode = this.vscode;
        const watcher = vscode.workspace.createFileSystemWatcher('**/*');
        watcher.onDidChange((e: any) => onChanged(e.fsPath));
        watcher.onDidCreate((e: any) => onChanged(e.fsPath));
        watcher.onDidDelete((e: any) => onChanged(e.fsPath));
    }
}
