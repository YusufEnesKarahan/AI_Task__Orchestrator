export class RetryController {
    private iteration = 0;

    constructor(private readonly maxIterations: number) {}

    /**
     * Güncel yineleme (iteration) sayısını döner.
     */
    public getIteration(): number {
        return this.iteration;
    }

    /**
     * Yineleme sayacını 1 artırır ve güncel sayıyı döner.
     */
    public increment(): number {
        this.iteration++;
        return this.iteration;
    }

    /**
     * Yeniden deneme yapılıp yapılamayacağına karar verir.
     */
    public canRetry(): boolean {
        return this.iteration < this.maxIterations;
    }

    /**
     * Sayacı sıfırlar.
     */
    public reset() {
        this.iteration = 0;
    }
}
