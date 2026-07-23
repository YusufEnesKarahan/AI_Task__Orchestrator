import { EventBus } from '../../shared/events/EventBus';

export class CacheManager {
    private readonly caches = new Map<string, Map<string, any>>();
    private readonly eventBus = EventBus.getInstance();

    private getCache(type: string): Map<string, any> {
        let cache = this.caches.get(type);
        if (!cache) {
            cache = new Map<string, any>();
            this.caches.set(type, cache);
        }
        return cache;
    }

    /**
     * Önbellekten okuma yapar.
     */
    public get(cacheType: string, key: string): any {
        const cache = this.getCache(cacheType);
        return cache.get(key);
    }

    /**
     * Önbelleğe yazma yapar ve CacheUpdated olayını tetikler.
     */
    public set(cacheType: string, key: string, value: any): void {
        const cache = this.getCache(cacheType);
        cache.set(key, value);
        this.eventBus.emit('CacheUpdated', { cacheType, keysCount: cache.size });
    }

    /**
     * Belirtilen veya tüm önbellek katmanlarını temizler.
     */
    public clear(cacheType?: string): void {
        if (cacheType) {
            const cache = this.caches.get(cacheType);
            if (cache) cache.clear();
        } else {
            this.caches.clear();
        }
    }
}
