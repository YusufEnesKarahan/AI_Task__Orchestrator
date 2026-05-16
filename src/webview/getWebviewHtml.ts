import * as vscode from 'vscode';

export function getWebviewHtml(webview: vscode.Webview, title: string, body: string): string {
    const nonce = createNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}';">
    <title>${escapeHtml(title)}</title>
    <style>
        :root {
            color-scheme: light dark;
        }

        body {
            margin: 0;
            padding: 16px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
            background: var(--vscode-editor-background);
        }

        .card {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 16px;
            background: var(--vscode-editorWidget-background);
        }

        h1 {
            margin: 0 0 12px;
            font-size: 1.1rem;
        }

        p {
            margin: 0;
            line-height: 1.5;
            color: var(--vscode-descriptionForeground);
        }

        button {
            margin-top: 16px;
            border: none;
            border-radius: 6px;
            padding: 8px 12px;
            cursor: pointer;
            color: var(--vscode-button-foreground);
            background: var(--vscode-button-background);
        }

        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    ${body}
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const openPanelButton = document.getElementById('open-panel');

        if (openPanelButton) {
            openPanelButton.addEventListener('click', () => {
                vscode.postMessage({ command: 'openPanel' });
            });
        }
    </script>
</body>
</html>`;
}

function createNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let value = '';

    for (let i = 0; i < 32; i += 1) {
        value += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return value;
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
