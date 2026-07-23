import { ActiveEditorInfo, SelectionInfo, DiagnosticInfo, WorkspaceInfo } from '../shared/bridgeTypes';

export interface IIDEHost {
    /**
     * Açık olan aktif editör bilgisini döndürür.
     */
    getActiveEditor(): ActiveEditorInfo | undefined;

    /**
     * Çalışma alanı (Workspace) bilgisini döndürür.
     */
    getWorkspace(): WorkspaceInfo;

    /**
     * Aktif editördeki seçili metin bilgisini döndürür.
     */
    getSelection(): SelectionInfo | undefined;

    /**
     * Bir IDE komutunu yürütür.
     */
    executeCommand(command: string, ...args: any[]): Promise<any>;

    /**
     * Kod uyarılarını/hatalarını (Diagnostics) listeler.
     */
    showDiagnostics(): DiagnosticInfo[];

    /**
     * Çalışma alanındaki dosya değişikliklerini izler.
     */
    watchWorkspace(onChanged: (filePath: string) => void): void;
}
