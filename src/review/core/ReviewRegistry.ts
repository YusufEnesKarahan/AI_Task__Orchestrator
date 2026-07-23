import { IReviewer } from './IReviewer';
import { ArchitectureReview } from '../implementations/ArchitectureReview';
import { CodeQualityReview } from '../implementations/CodeQualityReview';
import { TestCoverageReview } from '../implementations/TestCoverageReview';
import { SecurityReview } from '../implementations/SecurityReview';
import { PerformanceReview } from '../implementations/PerformanceReview';

export class ReviewRegistry {
    private static instance: ReviewRegistry;
    private readonly reviewers = new Map<string, IReviewer>();

    private constructor() {
        this.registerDefaults();
    }

    public static getInstance(): ReviewRegistry {
        if (!ReviewRegistry.instance) {
            ReviewRegistry.instance = new ReviewRegistry();
        }
        return ReviewRegistry.instance;
    }

    /**
     * İnceleyici kaydeder.
     */
    public register(reviewer: IReviewer): void {
        this.reviewers.set(reviewer.name, reviewer);
    }

    /**
     * İnceleyiciyi ismiyle döndürür.
     */
    public getReviewer(name: string): IReviewer | undefined {
        return this.reviewers.get(name);
    }

    /**
     * Tüm kayıtlı inceleyicileri döndürür.
     */
    public getAllReviewers(): IReviewer[] {
        return Array.from(this.reviewers.values());
    }

    /**
     * Tüm inceleyicileri temizler.
     */
    public clear(): void {
        this.reviewers.clear();
    }

    private registerDefaults() {
        this.register(new ArchitectureReview());
        this.register(new CodeQualityReview());
        this.register(new TestCoverageReview());
        this.register(new SecurityReview());
        this.register(new PerformanceReview());
    }
}
