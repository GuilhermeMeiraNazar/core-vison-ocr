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
exports.OcrPaths = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Caminhos para o motor OCR local (multilingual-purejs-ocr + modelos ONNX).
 *
 * Os modelos ficam em var/ocr/models/ — copiados do node_modules pelo
 * OcrInstaller na primeira execução. Padrão idêntico ao PopplerInstaller.
 */
class OcrPaths {
    constructor() {
        this.varPath = path.resolve(process.cwd(), 'var');
        this.ocrPath = path.join(this.varPath, 'ocr');
        this.modelsPath = path.join(this.ocrPath, 'models');
        fs.mkdirSync(this.modelsPath, { recursive: true });
    }
    /**
     * Localiza um arquivo de modelo dentro de var/ocr/models/.
     * Retorna o caminho absoluto ou null se não existir.
     */
    findModel(fileName) {
        const p = path.join(this.modelsPath, fileName);
        return fs.existsSync(p) ? p : null;
    }
    /**
     * Retorna o caminho esperado para um modelo (mesmo que ainda não exista).
     * Usado pelo OcrInstaller para saber onde copiar o arquivo.
     */
    modelPath(fileName) {
        return path.join(this.modelsPath, fileName);
    }
    /**
     * Localiza a pasta models/ dentro do pacote npm instalado.
     * Navega a partir do ponto de entrada do pacote.
     */
    getPackageModelsDir() {
        try {
            // Resolve o arquivo principal do pacote
            const pkgMain = require.resolve('multilingual-purejs-ocr');
            // Sobe até encontrar a pasta que contém 'models/'
            let dir = path.dirname(pkgMain);
            for (let i = 0; i < 5; i++) {
                const candidate = path.join(dir, 'models');
                if (fs.existsSync(candidate))
                    return candidate;
                dir = path.dirname(dir);
            }
            return null;
        }
        catch {
            return null;
        }
    }
    /** Verifica se o módulo pode ser resolvido pelo Node. */
    isPackageResolvable() {
        try {
            require.resolve('multilingual-purejs-ocr');
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.OcrPaths = OcrPaths;
//# sourceMappingURL=ocrPaths.js.map