import * as fs from 'fs';
import * as path from 'path';
import { EventBus } from '../shared/events/EventBus';
import { WorkflowEngine } from '../workflow/WorkflowEngine';
import { IIDEHost } from './core/IIDEHost';
import { VSCodeHost } from './core/VSCodeHost';
import { MockIDEHost } from './core/MockIDEHost';
import { BridgeMetrics } from './core/BridgeMetrics';
import { ActiveEditorInfo, SelectionInfo, DiagnosticInfo, WorkspaceInfo, BridgeRunLog, BridgeMetrics as IBridgeMetrics } from './shared/bridgeTypes';

export class IDEBridge {
    private readonly host: IIDEHost;
    private readonly eventBus = EventBus.getInstance();
    private readonly metricsTracker: BridgeMetrics;
    private readonly workflowEngine: WorkflowEngine;

    private readonly bridgeDir: string;
    private readonly historyPath: string;

    constructor(private readonly workspaceRoot: string) {
        this.bridgeDir = path.join(workspaceRoot, '.aios', 'bridge');
        this.historyPath = path.join(this.bridgeDir, 'bridge-history.json');
        
        this.ensureDirExists();
        this.metricsTracker = new BridgeMetrics(path.join(this.bridgeDir, 'bridge-metrics.json'));
        this.workflowEngine = new WorkflowEngine(workspaceRoot);

        // VS Code ortamı olup olmadığını kontrol et (Dinamik Import Kontrolü)
        let isVSCode = false;
        try {
            require('vscode');
            isVSCode = true;
        } catch {
            isVSCode = false;
        }

        if (isVSCode) {
            this.host = new VSCodeHost();
        } else {
            this.host = new MockIDEHost(workspaceRoot);
        }
    }

    private ensureDirExists() {
        if (!fs.existsSync(this.bridgeDir)) {
            fs.mkdirSync(this.bridgeDir, { recursive: true });
        }
    }

    /**
     * Dışarıdan MockIDEHost'a doğrudan müdahale etmek için host nesnesini döndürür.
     */
    public getHost(): IIDEHost {
        return this.host;
    }

    public getActiveEditor(): ActiveEditorInfo | undefined {
        const editor = this.host.getActiveEditor();
        if (editor) {
            this.logAndEmit('EditorOpened', { filePath: editor.filePath });
        }
        return editor;
    }

    public getWorkspace(): WorkspaceInfo {
        return this.host.getWorkspace();
    }

    public getSelection(): SelectionInfo | undefined {
        const selection = this.host.getSelection();
        if (selection) {
            this.logAndEmit('SelectionChanged', { text: selection.text, range: { startLine: selection.startLine, endLine: selection.endLine } });
        }
        return selection;
    }

    public async executeCommand(command: string, ...args: any[]): Promise<any> {
        try {
            const result = await this.host.executeCommand(command, ...args);
            this.logAndEmit('BridgeCommandExecuted', { command, success: true });
            return result;
        } catch (error) {
            this.logAndEmit('BridgeCommandExecuted', { command, success: false });
            throw error;
        }
    }

    public showDiagnostics(): DiagnosticInfo[] {
        const diags = this.host.showDiagnostics();
        diags.forEach(diag => {
            if (diag.severity === 'error' || diag.severity === 'warning') {
                this.logAndEmit('DiagnosticWarningAdded', { filePath: diag.filePath, message: diag.message });
            }
        });
        return diags;
    }

    /**
     * IDE üzerinden Workflow Engine tetikler.
     */
    public async startWorkflow(templateName: string): Promise<boolean> {
        this.logAndEmit('BridgeCommandExecuted', { command: `startWorkflow:${templateName}`, success: true });
        return this.workflowEngine.runWorkflow(templateName);
    }

    public getHistory(): BridgeRunLog[] {
        if (!fs.existsSync(this.historyPath)) return [];
        try {
            const data = fs.readFileSync(this.historyPath, 'utf-8');
            return JSON.parse(data) as BridgeRunLog[];
        } catch {
            return [];
        }
    }

    public getMetrics(): IBridgeMetrics {
        return this.metricsTracker.getMetrics();
    }

    public watchWorkspace(onChanged: (filePath: string) => void): void {
        this.host.watchWorkspace(onChanged);
    }

    private logAndEmit(eventName: string, payload: any) {
        const log: BridgeRunLog = {
            eventId: `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            eventName,
            timestamp: Date.now(),
            payload
        };

        // 1. EventBus üzerinden yayınla
        this.eventBus.emit(eventName, payload);

        // 2. Metrikleri güncelle
        this.metricsTracker.update(log);

        // 3. Dosyaya kaydet
        this.saveRunLog(log);
    }

    private saveRunLog(log: BridgeRunLog) {
        let history = this.getHistory();
        history.push(log);

        if (history.length > 100) {
            history.shift();
        }

        fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2), 'utf-8');
    }
}
