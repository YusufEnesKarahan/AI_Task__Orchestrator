export class ExecutionQueue {
    private readonly queue: Array<{ id: string; run: () => Promise<void> }> = [];
    private activeCount = 0;

    constructor(private readonly maxConcurrency: number = 3) {}

    /**
     * Kuyruğa yeni bir asenkron görev ekler ve hemen çalıştırmayı dener.
     */
    public push(id: string, run: () => Promise<void>): void {
        this.queue.push({ id, run });
        this.next();
    }

    /**
     * Bir sonraki boşta olan görevi tetikler.
     */
    private next(): void {
        if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
            return;
        }

        const task = this.queue.shift()!;
        this.activeCount++;

        task.run().finally(() => {
            this.activeCount--;
            this.next();
        });
    }

    /**
     * Aktif yürütülen iş sayısını döner.
     */
    public getActiveCount(): number {
        return this.activeCount;
    }

    /**
     * Kuyrukta bekleyen iş sayısını döner.
     */
    public getQueueLength(): number {
        return this.queue.length;
    }

    /**
     * Kuyruğu boşaltır.
     */
    public clear(): void {
        this.queue.length = 0;
    }
}
