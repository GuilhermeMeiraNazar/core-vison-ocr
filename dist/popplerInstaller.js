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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PopplerInstaller = void 0;
const axios_1 = __importDefault(require("axios"));
const extract_zip_1 = __importDefault(require("extract-zip"));
const fs = __importStar(require("fs"));
const fsPromises = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const promises_1 = require("stream/promises");
const popplerPaths_1 = require("./popplerPaths");
class PopplerInstaller {
    constructor(paths = new popplerPaths_1.PopplerPaths()) {
        this.paths = paths;
    }
    /** Retorna true se o pdftoppm.exe já existir. */
    isInstalled() {
        return this.paths.findBin('pdftoppm.exe') !== null;
    }
    /** Baixa e extrai o Poppler, se ainda não estiver instalado. */
    async install() {
        if (this.isInstalled()) {
            console.log('[Poppler] Binário já está pronto.');
            return;
        }
        try {
            console.log('[Poppler] Localizando versão mais recente...');
            // 1. Obtém o link real da última versão via API do GitHub
            const apiResponse = await axios_1.default.get('https://api.github.com/repos/oschwartz10612/poppler-windows/releases/latest');
            const asset = apiResponse.data.assets.find((a) => a.name.endsWith('.zip'));
            if (!asset)
                throw new Error('Não foi possível encontrar o arquivo zip na release.');
            const zipUrl = asset.browser_download_url;
            const zipPath = path.join(this.paths.varPath, 'poppler.zip');
            // 2. Garante que a pasta existe e está limpa
            if (fs.existsSync(this.paths.popplerPath)) {
                await fsPromises.rm(this.paths.popplerPath, { recursive: true, force: true });
            }
            await fsPromises.mkdir(this.paths.popplerPath, { recursive: true });
            // 3. Download robusto com pipeline
            console.log(`[Poppler] Baixando de: ${zipUrl}`);
            const response = await (0, axios_1.default)({ url: zipUrl, method: 'GET', responseType: 'stream' });
            await (0, promises_1.pipeline)(response.data, fs.createWriteStream(zipPath));
            // 4. Extrai
            console.log('[Poppler] Extraindo...');
            await (0, extract_zip_1.default)(zipPath, { dir: this.paths.popplerPath });
            // 5. Limpa o zip
            await fsPromises.unlink(zipPath);
            console.log('[Poppler] Instalado com sucesso.');
        }
        catch (error) {
            console.error('[Poppler] Erro crítico na instalação:', error);
            throw error;
        }
    }
}
exports.PopplerInstaller = PopplerInstaller;
//# sourceMappingURL=popplerInstaller.js.map