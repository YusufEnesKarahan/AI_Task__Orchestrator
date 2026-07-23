import { ReviewContext, ReviewerResult } from '../shared/reviewTypes';

export interface IReviewer {
    readonly name: string;

    /**
     * Kod değişikliklerini inceler ve sonuç raporu çıkarır.
     */
    review(context: ReviewContext): Promise<ReviewerResult>;
}
