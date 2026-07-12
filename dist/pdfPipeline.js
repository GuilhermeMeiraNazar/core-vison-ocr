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
exports.PdfPipeline = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const pageChunking_1 = require("./pageChunking");
class PdfPipeline {
    constructor(cfg) {
        this.cfg = cfg;
    }
    async extractTagsFromPdf(pdfPath, baseName) {
        const allDetections = await this.extractFromPdf(pdfPath, baseName, (imgPath) => this.cfg.ocrService.processImage(imgPath));
        return allDetections.map(det => ({
            tag: det.tag,
            confidence: det.confidence,
            x: det.globalCoordinates.centerX,
            y: det.globalCoordinates.centerY,
            page: det.page,
        }));
    }
    async extractFromPdf(pdfPath, baseName, extractor) {
        const { popplerService, dpi, chunkMaxRasterMb, chunkOverlapPx, tempDir, debugDir, debugSavePng, } = this.cfg;
        const totalPages = popplerService.getPageCount(pdfPath);
        console.log(`[PDF] Total de páginas: ${totalPages}`);
        const maxPixelsPerChunk = Math.floor((chunkMaxRasterMb * 1024 * 1024) / 3);
        const allResults = [];
        for (let page = 1; page <= totalPages; page++) {
            console.log(`\n  [Página ${page}/${totalPages}]`);
            const pageSizePts = popplerService.getPageSizePts(pdfPath, page);
            const pageWpx = (0, pageChunking_1.ptsToPx)(pageSizePts.widthPts, dpi);
            const pageHpx = (0, pageChunking_1.ptsToPx)(pageSizePts.heightPts, dpi);
            const chunks = (0, pageChunking_1.buildChunkPlan)(pageWpx, pageHpx, maxPixelsPerChunk, chunkOverlapPx);
            if (chunks.length > 1) {
                console.log(`  -> Página ${pageWpx}×${pageHpx}px | ${chunks.length} blocos de rasterização`);
            }
            else {
                console.log(`  -> Página ${pageWpx}×${pageHpx}px | bloco único (sem fatiamento)`);
            }
            for (let ci = 0; ci < chunks.length; ci++) {
                const chunk = chunks[ci];
                const chunkLabel = `${page}_${ci + 1}`;
                process.stdout.write(`  -> Rasterizando bloco ${ci + 1}/${chunks.length} ` +
                    `(${Math.round(chunk.w)}×${Math.round(chunk.h)}px)...`);
                const rendered = popplerService.rasterizeRegion(pdfPath, page, tempDir, dpi, chunk, chunkLabel);
                console.log(` OK (${path.basename(rendered.filePath)})`);
                if (debugSavePng) {
                    const debugCopy = path.join(debugDir, `${baseName}_page_${page}_chunk_${ci + 1}.png`);
                    fs.copyFileSync(rendered.filePath, debugCopy);
                    console.log(`  -> [Debug] PNG salvo: ${path.relative(process.cwd(), debugCopy)}`);
                }
                process.stdout.write(`  -> Extraindo do bloco ${ci + 1}/${chunks.length}...\n`);
                const chunkStartTime = Date.now();
                const detected = await extractor(rendered.filePath);
                const chunkElapsed = ((Date.now() - chunkStartTime) / 1000).toFixed(1);
                console.log(`  -> Bloco ${ci + 1} concluído em ${chunkElapsed}s — ${detected.length} detecção(ões)`);
                for (const det of detected) {
                    const result = {
                        ...det,
                        page,
                    };
                    if (det.globalCoordinates) {
                        const gc = det.globalCoordinates;
                        result.globalCoordinates = {
                            centerX: gc.centerX + chunk.x,
                            centerY: gc.centerY + chunk.y,
                            xMin: gc.xMin + chunk.x,
                            yMin: gc.yMin + chunk.y,
                            xMax: gc.xMax + chunk.x,
                            yMax: gc.yMax + chunk.y,
                        };
                    }
                    allResults.push(result);
                }
            }
        }
        return allResults;
    }
}
exports.PdfPipeline = PdfPipeline;
//# sourceMappingURL=pdfPipeline.js.map