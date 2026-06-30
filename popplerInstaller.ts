import axios from 'axios';
import extractZip from 'extract-zip';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { PopplerPaths } from './popplerPaths';

export class PopplerInstaller {
    private paths: PopplerPaths;

    constructor(paths: PopplerPaths = new PopplerPaths()) {
        this.paths = paths;
    }

    /** Retorna true se o pdftoppm.exe já existir. */
    public isInstalled(): boolean {
        return this.paths.findBin('pdftoppm.exe') !== null;
    }

    /** Baixa e extrai o Poppler, se ainda não estiver instalado. */
    public async install(): Promise<void> {
        if (this.isInstalled()) {
            console.log('[Poppler] Binário já está pronto.');
            return;
        }

        try {
            console.log('[Poppler] Localizando versão mais recente...');

            // 1. Obtém o link real da última versão via API do GitHub
            const apiResponse = await axios.get(
                'https://api.github.com/repos/oschwartz10612/poppler-windows/releases/latest'
            );
            const asset = apiResponse.data.assets.find((a: any) => a.name.endsWith('.zip'));
            if (!asset) throw new Error('Não foi possível encontrar o arquivo zip na release.');

            const zipUrl = asset.browser_download_url;
            const zipPath = path.join(this.paths.varPath, 'poppler.zip');

            // 2. Garante que a pasta existe e está limpa
            if (fs.existsSync(this.paths.popplerPath)) {
                await fsPromises.rm(this.paths.popplerPath, { recursive: true, force: true });
            }
            await fsPromises.mkdir(this.paths.popplerPath, { recursive: true });

            // 3. Download robusto com pipeline
            console.log(`[Poppler] Baixando de: ${zipUrl}`);
            const response = await axios({ url: zipUrl, method: 'GET', responseType: 'stream' });
            await pipeline(response.data, fs.createWriteStream(zipPath));

            // 4. Extrai
            console.log('[Poppler] Extraindo...');
            await extractZip(zipPath, { dir: this.paths.popplerPath });

            // 5. Limpa o zip
            await fsPromises.unlink(zipPath);
            console.log('[Poppler] Instalado com sucesso.');

        } catch (error) {
            console.error('[Poppler] Erro crítico na instalação:', error);
            throw error;
        }
    }
}