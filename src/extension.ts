import * as vscode from 'vscode';
import { PROVIDER_SECRET_KEYS } from './providers/providerConfig';
import { SidebarViewProvider } from './webview/SidebarViewProvider';
import { WebviewPanelController } from './webview/WebviewPanelController';

export function activate(context: vscode.ExtensionContext) {
    const sidebarProvider = new SidebarViewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SidebarViewProvider.viewType,
            sidebarProvider
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-task-orchestrator.openPanel', () => {
            WebviewPanelController.render(context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-task-orchestrator.setOpenAIApiKey', async () => {
            await storeApiKey(context, 'OpenAI', PROVIDER_SECRET_KEYS.openai);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-task-orchestrator.setGeminiApiKey', async () => {
            await storeApiKey(context, 'Gemini', PROVIDER_SECRET_KEYS.gemini);
        })
    );
}

export function deactivate() {}

async function storeApiKey(
    context: vscode.ExtensionContext,
    providerName: 'OpenAI' | 'Gemini',
    secretKey: string
): Promise<void> {
    const value = await vscode.window.showInputBox({
        prompt: `${providerName} API key`,
        password: true,
        ignoreFocusOut: true,
        placeHolder: `Paste your ${providerName} API key`
    });

    if (value === undefined) {
        return;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        vscode.window.showWarningMessage(`${providerName} API key was not saved because the value was empty.`);
        return;
    }

    await context.secrets.store(secretKey, trimmed);
    vscode.window.showInformationMessage(`${providerName} API key saved to VS Code SecretStorage.`);
}
