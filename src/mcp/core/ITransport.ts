export interface ITransport {
    /**
     * MCP sunucusuna bağlantı açar.
     */
    connect(serverUrl: string): Promise<boolean>;

    /**
     * Bağlantıyı kapatır.
     */
    disconnect(): Promise<void>;

    /**
     * Sunucuya JSON-RPC formatında mesaj gönderir ve cevabını bekler.
     */
    send(message: any): Promise<any>;
}
