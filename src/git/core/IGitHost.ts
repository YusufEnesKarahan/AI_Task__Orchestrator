import { GitStatus, GitDiffInfo } from '../shared/gitTypes';

export interface IGitHost {
    /**
     * Git repository'sini açar veya doğrular.
     */
    openRepository(): Promise<boolean>;

    /**
     * Repository'nin anlık durumunu döndürür.
     */
    getStatus(): Promise<GitStatus>;

    /**
     * Belirtilen isimde yeni bir branch oluşturur.
     */
    createBranch(branchName: string): Promise<boolean>;

    /**
     * Belirtilen branch'e geçiş yapar.
     */
    switchBranch(branchName: string): Promise<boolean>;

    /**
     * Yapılan değişikliklerin (diff) detaylı analizini döndürür.
     */
    analyzeDiff(): Promise<GitDiffInfo>;

    /**
     * Yapılan değişiklikleri belirtilen mesaj ile commit eder ve hash değerini döndürür.
     */
    commit(message: string): Promise<string>;

    /**
     * Merge conflict tespiti yaparak çakışan dosyaların yollarını döndürür.
     */
    detectConflicts(): Promise<string[]>;
}
