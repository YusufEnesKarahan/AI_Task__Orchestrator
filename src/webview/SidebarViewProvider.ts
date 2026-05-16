import * as vscode from 'vscode';
import { getWebviewHtml } from './getWebviewHtml';

export class SidebarViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ai-task-orchestrator.sidebar';

    constructor(private readonly extensionUri: vscode.Uri) {
        void this.extensionUri;
    }

    public resolveWebviewView(webviewView: vscode.WebviewView): void {
        webviewView.webview.options = {
            enableScripts: true
        };

        webviewView.webview.html = getWebviewHtml(
            webviewView.webview,
            'AI Task Orchestrator',
            `
                <div class="card">
                    <h1>AI Task Orchestrator</h1>
                    <p>This is the minimum sidebar view for the extension.</p>
                    <button id="open-panel">Open Webview Panel</button>
                </div>
            `
        );

        webviewView.webview.onDidReceiveMessage(async message => {
            if (message.command === 'openPanel') {
                await vscode.commands.executeCommand('ai-task-orchestrator.openPanel');
            }
        });
    }
}
