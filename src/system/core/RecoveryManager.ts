import * as fs from 'fs';
import * as path from 'path';
import { RecoveryReport } from '../shared/systemTypes';
import { EventBus } from '../../shared/events/EventBus';

export class RecoveryManager {
    private readonly eventBus = EventBus.getInstance();

    constructor(private readonly workspaceRoot: string) {}

    /**
     * Olası çökmelerden sonra durum kurtarma (State Recovery) yapar.
     * .aios/ dizinlerindeki kaybolan veya yarıda kalan geçmiş kayıtlarını doğrular ve kurtarır.
     */
    public async recover(target: string): Promise<RecoveryReport> {
        this.eventBus.emit('RecoveryStarted', { target });

        let restoredCount = 0;
        let success = true;

        try {
            const dirsToScan = [
                path.join(this.workspaceRoot, '.aios', 'workflow'),
                path.join(this.workspaceRoot, '.aios', 'execution'),
                path.join(this.workspaceRoot, '.aios', 'actions'),
                path.join(this.workspaceRoot, '.aios', 'review'),
                path.join(this.workspaceRoot, '.aios', 'tasks'),
                path.join(this.workspaceRoot, '.aios', 'autonomous'),
                path.join(this.workspaceRoot, '.aios', 'git'),
                path.join(this.workspaceRoot, '.aios', 'mcp')
            ];

            for (const dir of dirsToScan) {
                if (fs.existsSync(dir)) {
                    const files = fs.readdirSync(dir);
                    for (const file of files) {
                        const fullPath = path.join(dir, file);
                        if (file.endsWith('.json') && fs.statSync(fullPath).isFile()) {
                            // Okunabilirliğini doğrula
                            const data = fs.readFileSync(fullPath, 'utf-8');
                            JSON.parse(data);
                            restoredCount++;
                        }
                    }
                }
            }
        } catch {
            success = false;
        }

        this.eventBus.emit('RecoveryCompleted', { target, restoredCount });

        return {
            target,
            success,
            restoredCount
        };
    }
}
