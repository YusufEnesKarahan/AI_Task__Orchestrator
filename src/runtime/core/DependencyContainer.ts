export class DependencyContainer {
    private readonly singletons = new Map<string, any>();
    private readonly factories = new Map<string, () => any>();
    private readonly singletonFactories = new Map<string, () => any>();

    /**
     * Lazy factory kaydı — her resolve çağrısında yeni instance üretir.
     */
    public register<T>(name: string, factory: () => T): void {
        this.factories.set(name, factory);
    }

    /**
     * Singleton factory kaydı — ilk resolve'da yaratılır, sonraki çağrılarda aynı instance döner.
     */
    public singleton<T>(name: string, factory: () => T): void {
        this.singletonFactories.set(name, factory);
    }

    /**
     * Kayıtlı servisi çözümler.
     */
    public resolve<T>(name: string): T {
        // 1. Zaten yaratılmış singleton var mı?
        if (this.singletons.has(name)) {
            return this.singletons.get(name) as T;
        }

        // 2. Singleton factory var mı?
        if (this.singletonFactories.has(name)) {
            const instance = this.singletonFactories.get(name)!();
            this.singletons.set(name, instance);
            return instance as T;
        }

        // 3. Normal factory var mı?
        if (this.factories.has(name)) {
            return this.factories.get(name)!() as T;
        }

        throw new Error(`DI: "${name}" servisi kayıtlı değil.`);
    }

    /**
     * Kayıt varlığını sorgular.
     */
    public has(name: string): boolean {
        return this.factories.has(name) || this.singletonFactories.has(name) || this.singletons.has(name);
    }

    /**
     * Toplam kayıtlı servis sayısını döner.
     */
    public get registeredCount(): number {
        const allKeys = new Set([
            ...this.factories.keys(),
            ...this.singletonFactories.keys(),
            ...this.singletons.keys()
        ]);
        return allKeys.size;
    }

    /**
     * Tüm kayıtları temizler.
     */
    public clear(): void {
        this.factories.clear();
        this.singletonFactories.clear();
        this.singletons.clear();
    }
}
