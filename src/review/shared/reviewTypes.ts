export interface ReviewContext {
    workspaceRoot: string;
    changedFiles: string[];
    actionResults?: any[];
}

export interface ReviewerResult {
    reviewerName: string;
    passed: boolean;
    issues: string[];
    warnings: string[];
    score: number; // 0 to 100 rating
}

export interface ReviewReport {
    reviewId: string;
    timestamp: number;
    passed: boolean;
    score: number; // overall average score
    targetFiles: string[];
    results: ReviewerResult[];
}

export interface ReviewMetrics {
    totalReviews: number;
    averageScore: number;
    passedCount: number;
    failedCount: number;
}
