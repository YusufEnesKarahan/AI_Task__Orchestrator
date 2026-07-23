import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceSnapshot } from './WorkspaceSnapshot';

export class RollbackManager {
    /**
     * WorkspaceSnapshot verisini kullanarak tüm dosya sistemi değişikliklerini geri alır.
     */
    public async rollback(snapshot: WorkspaceSnapshot): Promise<void> {
        const backups = snapshot.getBackups();

        // Geri alma işlemi yaparken en son yapılan değişiklikten geriye doğru gidebiliriz (ters sıra)
        for (let i = backups.length - 1; i >= 0; i--) {
            const backup = backups[i];
            const absolutePath = backup.filePath;

            if (backup.content === null) {
                // Önceden dosya yoktu -> oluşturulmuşsa sil
                if (fs.existsSync(absolutePath)) {
                    try {
                        fs.unlinkSync(absolutePath);
                    } catch (error) {
                        console.error(`[RollbackManager] Yeni oluşturulan dosya silinemedi: ${absolutePath}`, error);
                    }
                }
            } else {
                // Önceden dosya vardı -> orijinal içeriği geri yükle
                try {
                    const dir = path.dirname(absolutePath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    fs.writeFileSync(absolutePath, backup.content, 'utf-8');
                } catch (error) {
                    console.error(`[RollbackManager] Orijinal dosya geri yüklenemedi: ${absolutePath}`, error);
                }
            }
        }
    }
}
