export interface GitStatus {
    currentBranch: string;
    isClean: boolean;
    modifiedFiles: string[];
    untrackedFiles: string[];
}

export interface FileDiffSummary {
    filePath: string;
    additions: number;
    deletions: number;
    type: 'test' | 'code' | 'docs' | 'refactor' | 'unknown';
}

export interface GitDiffInfo {
    changedFiles: number;
    insertions: number;
    deletions: number;
    fileDiffs: FileDiffSummary[];
}

export interface GitHistoryLog {
    eventId: string;
    eventName: string;
    timestamp: number;
    payload: any;
}

export interface GitMetrics {
    commitsCreated: number;
    branchesCreated: number;
    conflictsDetected: number;
}
