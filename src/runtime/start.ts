#!/usr/bin/env node

import { AIOSApplication } from './AIOSApplication';

async function main() {
    const app = AIOSApplication.create();
    const ok = await app.start();

    if (!ok) {
        console.error('AIOS başlatılamadı.');
        process.exit(1);
    }

    // Graceful shutdown sinyalleri
    const shutdown = async () => {
        await app.stop();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch(err => {
    console.error('AIOS çalışma hatası:', err);
    process.exit(1);
});
