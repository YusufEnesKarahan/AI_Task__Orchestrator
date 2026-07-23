import * as fs from 'fs';
import { ReviewMetrics as IReviewMetrics, ReviewReport } from '../shared/reviewTypes';

export class ReviewMetrics {
    private metrics: IReviewMetrics = {
        totalReviews: 0,
        averageScore: 0,
        passedCount: 0,
        failedCount: 0
    };

    constructor(private readonly metricsPath: string) {
        this.load();
    }

    /**
     * Güncel metrik verilerini döner.
     */
    public getMetrics(): IReviewMetrics {
        return this.metrics;
    }

    /**
     * Yeni bir inceleme raporuyla metrikleri günceller ve kaydeder.
     */
    public update(report: ReviewReport): void {
        const total = this.metrics.totalReviews;
        const currentSum = this.metrics.averageScore * total;
        const newTotal = total + 1;
        const newAvg = Math.round((currentSum + report.score) / newTotal);

        this.metrics = {
            totalReviews: newTotal,
            averageScore: newAvg,
            passedCount: this.metrics.passedCount + (report.passed ? 1 : 0),
            failedCount: this.metrics.failedCount + (report.passed ? 0 : 1)
        };

        this.save();
    }

    private load() {
        if (!fs.existsSync(this.metricsPath)) return;
        try {
            const data = fs.readFileSync(this.metricsPath, 'utf-8');
            this.metrics = JSON.parse(data) as IReviewMetrics;
        } catch {
            // ignore
        }
    }

    private save() {
        try {
            fs.writeFileSync(this.metricsPath, JSON.stringify(this.metrics, null, 2), 'utf-8');
        } catch {
            // ignore
        }
    }
}
