import * as fs from 'fs';
import * as path from 'path';
import { IAction } from '../core/IAction';
import { ActionResult } from '../shared/actionTypes';

export class ApplyPatchAction implements IAction {
    public validate(payload: any): boolean {
        return (!!payload.path || !!payload.filePath) && !!payload.patch;
    }

    public async execute(payload: any, workspaceRoot: string): Promise<ActionResult> {
        const targetPath = payload.path || payload.filePath;
        const absolutePath = path.isAbsolute(targetPath) ? targetPath : path.join(workspaceRoot, targetPath);

        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Patch uygulanacak hedef dosya bulunamadı: ${absolutePath}`);
        }

        let content = fs.readFileSync(absolutePath, 'utf-8');
        const patchStr = payload.patch;

        // 1. Standart SEARCH / REPLACE blok parser
        if (patchStr.includes('<<<<<<< SEARCH') && patchStr.includes('=======') && patchStr.includes('>>>>>>>')) {
            const blocks = patchStr.split('<<<<<<< SEARCH');
            for (const block of blocks) {
                if (!block.trim()) continue;
                const parts = block.split('=======');
                if (parts.length !== 2) continue;
                const searchPart = parts[0].trim();
                const replacePartAndMore = parts[1];
                const endIdx = replacePartAndMore.indexOf('>>>>>>>');
                if (endIdx === -1) continue;
                const replacePart = replacePartAndMore.slice(0, endIdx).trim();

                if (content.includes(searchPart)) {
                    content = content.replace(searchPart, replacePart);
                } else {
                    throw new Error(`Patch bloğundaki aranacak kısım bulunamadı: "${searchPart}"`);
                }
            }
        } 
        // 2. Basit testler için "old|||new" ayracı
        else if (patchStr.includes('|||')) {
            const parts = patchStr.split('|||');
            const search = parts[0];
            const replace = parts[1];
            if (content.includes(search)) {
                content = content.replace(search, replace);
            } else {
                throw new Error(`Aranacak kısım dosya içinde bulunamadı: ${search}`);
            }
        } 
        // 3. Fallback: Metni sonuna ekleme
        else {
            content += `\n${patchStr}`;
        }

        fs.writeFileSync(absolutePath, content, 'utf-8');

        return {
            success: true,
            output: `Patch başarıyla uygulandı: ${absolutePath}`,
            executedAt: Date.now()
        };
    }
}
