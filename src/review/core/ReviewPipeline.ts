import { EventBus } from '../../shared/events/EventBus';
import { ReviewRegistry } from './ReviewRegistry';
import { ReviewContext, ReviewReport, ReviewerResult } from '../shared/reviewTypes';

export class ReviewPipeline {
    public readonly id: string;
    private readonly reviewersList: string[] = [];
    private readonly registry = ReviewRegistry.getInstance();
    private readonly eventBus = EventBus.getInstance();

    constructor(id?: string) {
        this.id = id || `rev_pipe_${Date.now()}`;
    }

    /**
     * Pipeline'a yeni bir inceleyici adım ekler.
     */
    public addReviewer(name: string): this {
        this.reviewersList.push(name);
        return this;
    }

    /**
     * Pipeline üzerindeki tüm inceleyicileri sırayla koordine eder.
     */
    public async run(context: ReviewContext): Promise<ReviewReport> {
        this.eventBus.emit('CodeReviewStarted', { reviewId: this.id, targetFiles: context.changedFiles });

        const results: ReviewerResult[] = [];
        let totalScore = 0;
        let passed = true;

        for (const name of this.reviewersList) {
            const reviewer = this.registry.getReviewer(name);
            if (!reviewer) {
                const dummy: ReviewerResult = {
                    reviewerName: name,
                    passed: false,
                    issues: [`İnceleyici sistemde bulunamadı: ${name}`],
                    warnings: [],
                    score: 0
                };
                results.push(dummy);
                passed = false;
                this.eventBus.emit('CodeReviewStepCompleted', { reviewId: this.id, reviewer: name, result: dummy });
                continue;
            }

            try {
                const res = await reviewer.review(context);
                results.push(res);
                totalScore += res.score;
                
                if (!res.passed) {
                    passed = false;
                }
                
                this.eventBus.emit('CodeReviewStepCompleted', { reviewId: this.id, reviewer: name, result: res });
            } catch (err: any) {
                const errorResult: ReviewerResult = {
                    reviewerName: name,
                    passed: false,
                    issues: [err?.message || String(err)],
                    warnings: [],
                    score: 0
                };
                results.push(errorResult);
                passed = false;
                this.eventBus.emit('CodeReviewStepCompleted', { reviewId: this.id, reviewer: name, result: errorResult });
            }
        }

        const averageScore = this.reviewersList.length > 0 
            ? Math.round(totalScore / this.reviewersList.length) 
            : 100;

        const report: ReviewReport = {
            reviewId: this.id,
            timestamp: Date.now(),
            passed,
            score: averageScore,
            targetFiles: context.changedFiles,
            results
        };

        this.eventBus.emit('CodeReviewCompleted', { reviewId: this.id, passed, score: averageScore });

        return report;
    }
}
