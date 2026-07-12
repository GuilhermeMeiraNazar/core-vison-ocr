"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrInstaller = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ocrPaths_1 = require("./ocrPaths");
/**
 * Modelos necessários para inglês (única língua usada no projeto).
 * Apenas detection + english recognition + english dict.
 * Nomes exatos conforme a estrutura do pacote multilingual-purejs-ocr.
 */
const REQUIRED_MODELS = [
    'ch_PP-OCRv4_det_infer.onnx', // detecção (compartilhado entre idiomas)
    'en_PP-OCRv4_rec_infer.onnx', // reconhecimento inglês
    'en_dict.txt', // dicionário inglês
];
/**
 * Instalador do motor OCR.
 *
 * Segue o mesmo padrão de PopplerInstaller e OllamaInstaller:
 *   - isInstalled() verifica se os arquivos já estão em var/ocr/models/
 *   - install() copia os modelos do node_modules para var/ocr/models/
 *
 * Só precisa rodar uma vez. Nas execuções seguintes, os modelos já estarão
 * em var/ocr/models/ e o método retorna imediatamente.
 */
class OcrInstaller {
    constructor(paths = new ocrPaths_1.OcrPaths()) {
        this.paths = paths;
    }
    /**
     * Retorna true se todos os modelos necessários já estiverem em var/ocr/models/.
     */
    isInstalled() {
        return REQUIRED_MODELS.every(f => this.paths.findModel(f) !== null);
    }
    /**
     * Copia os modelos ONNX do node_modules para var/ocr/models/.
     * Idempotente: não faz nada se os arquivos já existirem.
     */
    async install() {
        if (this.isInstalled()) {
            console.log('[OCR] Modelos já presentes em var/ocr/models/.');
            return;
        }
        if (!this.paths.isPackageResolvable()) {
            throw new Error('[OCR] Pacote "multilingual-purejs-ocr" não encontrado.\n' +
                '      Execute: npm install\n');
        }
        const srcDir = this.paths.getPackageModelsDir();
        if (!srcDir) {
            throw new Error('[OCR] Não foi possível localizar a pasta models/ dentro do pacote.\n' +
                '      Tente: npm install multilingual-purejs-ocr\n');
        }
        console.log(`[OCR] Copiando modelos de: ${srcDir}`);
        console.log(`[OCR] Destino: ${this.paths.modelsPath}`);
        for (const fileName of REQUIRED_MODELS) {
            const src = path.join(srcDir, fileName);
            const dest = this.paths.modelPath(fileName);
            if (fs.existsSync(dest)) {
                console.log(`[OCR]   já existe: ${fileName}`);
                continue;
            }
            if (!fs.existsSync(src)) {
                throw new Error(`[OCR] Modelo não encontrado no pacote: ${src}\n` +
                    `      Verifique se o pacote está instalado corretamente.\n`);
            }
            process.stdout.write(`[OCR]   copiando ${fileName}...`);
            fs.copyFileSync(src, dest);
            const sizeMB = (fs.statSync(dest).size / 1024 / 1024).toFixed(1);
            console.log(` OK (${sizeMB} MB)`);
        }
        console.log('[OCR] Modelos instalados com sucesso em var/ocr/models/.');
    }
}
exports.OcrInstaller = OcrInstaller;
//# sourceMappingURL=ocrInstaller.js.map