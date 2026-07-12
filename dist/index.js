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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("./config");
const popplerPaths_1 = require("./popplerPaths");
const popplerInstaller_1 = require("./popplerInstaller");
const popplerService_1 = require("./popplerService");
const ocrPaths_1 = require("./ocrPaths");
const ocrInstaller_1 = require("./ocrInstaller");
const ocrService_1 = require("./ocrService");
const pdfPipeline_1 = require("./pdfPipeline");
const cfg = (0, config_1.loadConfig)();
async function run() {
    console.log('');
    console.log('==========================================');
    console.log(' Core Vision OCR');
    console.log('==========================================');
    console.log('');
    fs.mkdirSync(cfg.outputDir, { recursive: true });
    fs.mkdirSync(cfg.tempDir, { recursive: true });
    fs.mkdirSync(cfg.inputDir, { recursive: true });
    if (cfg.debugSavePng)
        fs.mkdirSync(cfg.debugDir, { recursive: true });
    console.log(`[Config] DPI: ${cfg.dpi} | Tile: ${cfg.tileSize}px | Overlap: ${cfg.overlap}px | ` +
        `Chunk budget: ${cfg.chunkMaxRasterMb}MB | Debug PNG: ${cfg.debugSavePng ? 'ON' : 'OFF'}`);
    console.log('[Setup] Verificando Poppler e OCR...');
    const popplerPaths = new popplerPaths_1.PopplerPaths();
    const popplerInstaller = new popplerInstaller_1.PopplerInstaller(popplerPaths);
    const popplerService = new popplerService_1.PopplerService(popplerPaths);
    const ocrPaths = new ocrPaths_1.OcrPaths();
    const ocrInstaller = new ocrInstaller_1.OcrInstaller(ocrPaths);
    const ocrService = new ocrService_1.OcrService(ocrPaths, {
        tileSize: cfg.tileSize,
        overlap: cfg.overlap,
        dedupeProximityPx: cfg.dedupePx,
    });
    await Promise.all([
        popplerInstaller.install(),
        ocrInstaller.install(),
    ]);
    await ocrService.init();
    const pipeline = new pdfPipeline_1.PdfPipeline({
        popplerService,
        ocrService,
        dpi: cfg.dpi,
        chunkMaxRasterMb: cfg.chunkMaxRasterMb,
        chunkOverlapPx: cfg.chunkOverlapPx,
        tempDir: cfg.tempDir,
        debugDir: cfg.debugDir,
        debugSavePng: cfg.debugSavePng,
    });
    const pdfFiles = fs.readdirSync(cfg.inputDir)
        .filter(f => f.toLowerCase().endsWith('.pdf'))
        .sort((a, b) => a.localeCompare(b));
    if (pdfFiles.length === 0) {
        console.log('\n[Aviso] Nenhum PDF encontrado em:', cfg.inputDir);
        console.log('        Coloque arquivos .pdf na pasta input/ e rode novamente.');
        return;
    }
    console.log(`\n[Input] ${pdfFiles.length} PDF(s) encontrado(s): ${pdfFiles.join(', ')}`);
    for (const fileName of pdfFiles) {
        const pdfPath = path.join(cfg.inputDir, fileName);
        const baseName = path.basename(fileName, '.pdf');
        console.log(`\n${'-'.repeat(50)}`);
        console.log(`[PDF] Processando: ${fileName}`);
        const allTags = await pipeline.extractTagsFromPdf(pdfPath, baseName);
        const outputPath = path.join(cfg.outputDir, `${baseName}_tags.json`);
        fs.writeFileSync(outputPath, JSON.stringify(allTags, null, 2), 'utf8');
        console.log(`\n[Output] JSON salvo em: ${path.relative(process.cwd(), outputPath)}`);
        if (allTags.length === 0) {
            console.log('[Resultado] Nenhuma tag encontrada neste PDF.');
        }
        else {
            const uniqueTags = [...new Set(allTags.map(t => t.tag))].sort();
            console.log(`[Resultado] ${allTags.length} tags detectadas (${uniqueTags.length} únicas): ${uniqueTags.join(', ')}`);
        }
    }
    console.log('\n==========================================');
    console.log(' Processamento concluído!');
    console.log('==========================================');
}
run().catch(err => {
    console.error('\n[Erro fatal]', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map