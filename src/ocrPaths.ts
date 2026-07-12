import * as fs from 'fs';
import * as path from 'path';

/**
 * Caminhos para o motor OCR local (multilingual-purejs-ocr + modelos ONNX).
 *
 * Os modelos ficam em var/ocr/models/ — copiados do node_modules pelo
 * OcrInstaller na primeira execução. Padrão idêntico ao PopplerInstaller.
 */
export class OcrPaths {
    /** Raiz de todos os binários/assets gerenciados pela aplicação. */
    public readonly varPath: string;

    /** Subpasta reservada ao OCR. */
    public readonly ocrPath: string;

    /** Pasta onde os modelos ONNX ficam após a instalação. */
    public readonly modelsPath: string;

    constructor() {
        this.varPath   = path.resolve(process.cwd(), 'var');
        this.ocrPath   = path.join(this.varPath, 'ocr');
        this.modelsPath = path.join(this.ocrPath, 'models');

        fs.mkdirSync(this.modelsPath, { recursive: true });
    }

    /**
     * Localiza um arquivo de modelo dentro de var/ocr/models/.
     * Retorna o caminho absoluto ou null se não existir.
     */
    public findModel(fileName: string): string | null {
        const p = path.join(this.modelsPath, fileName);
        return fs.existsSync(p) ? p : null;
    }

    /**
     * Retorna o caminho esperado para um modelo (mesmo que ainda não exista).
     * Usado pelo OcrInstaller para saber onde copiar o arquivo.
     */
    public modelPath(fileName: string): string {
        return path.join(this.modelsPath, fileName);
    }

    /**
     * Localiza a pasta models/ dentro do pacote npm instalado.
     * Navega a partir do ponto de entrada do pacote.
     */
    public getPackageModelsDir(): string | null {
        try {
            // Resolve o arquivo principal do pacote
            const pkgMain = require.resolve('multilingual-purejs-ocr');
            // Sobe até encontrar a pasta que contém 'models/'
            let dir = path.dirname(pkgMain);
            for (let i = 0; i < 5; i++) {
                const candidate = path.join(dir, 'models');
                if (fs.existsSync(candidate)) return candidate;
                dir = path.dirname(dir);
            }
            return null;
        } catch {
            return null;
        }
    }

    /** Verifica se o módulo pode ser resolvido pelo Node. */
    public isPackageResolvable(): boolean {
        try {
            require.resolve('multilingual-purejs-ocr');
            return true;
        } catch {
            return false;
        }
    }
}