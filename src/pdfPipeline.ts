import * as fs from 'fs';
import * as path from 'path';
import { PopplerService } from './popplerService';
import { OcrService, DetectedTag } from './ocrService';
import { ptsToPx, buildChunkPlan } from './pageChunking';

export interface PdfPipelineConfig {
    popplerService: PopplerService;
    ocrService: OcrService;
    dpi: number;
    chunkMaxRasterMb: number;
    chunkOverlapPx: number;
    tempDir: string;
    debugDir: string;
    debugSavePng: boolean;
}

export interface TagWithPage {
    tag: string;
    confidence: number;
    x: number;
    y: number;
    page: number;
}

type DetectedWithPage = DetectedTag & { page: number };

export class PdfPipeline {
    constructor(private cfg: PdfPipelineConfig) {}

    async extractTagsFromPdf(pdfPath: string, baseName: string): Promise<TagWithPage[]> {
        const allDetections: DetectedWithPage[] = await this.extractFromPdf<DetectedTag>(
            pdfPath,
            baseName,
            (imgPath) => this.cfg.ocrService.processImage(imgPath)
        );

        return allDetections.map(det => ({
            tag: det.tag,
            confidence: det.confidence,
            x: det.globalCoordinates.centerX,
            y: det.globalCoordinates.centerY,
            page: det.page,
        }));
    }

    async extractFromPdf<T>(
        pdfPath: string,
        baseName: string,
        extractor: (imagePath: string) => Promise<T[]>
    ): Promise<(T & { page: number })[]> {
        const {
            popplerService,
            dpi,
            chunkMaxRasterMb,
            chunkOverlapPx,
            tempDir,
            debugDir,
            debugSavePng,
        } = this.cfg;

        const totalPages = popplerService.getPageCount(pdfPath);
        console.log(`[PDF] Total de páginas: ${totalPages}`);

        const maxPixelsPerChunk = Math.floor((chunkMaxRasterMb * 1024 * 1024) / 3);
        const allResults: (T & { page: number })[] = [];

        for (let page = 1; page <= totalPages; page++) {
            console.log(`\n  [Página ${page}/${totalPages}]`);

            const pageSizePts = popplerService.getPageSizePts(pdfPath, page);
            const pageWpx = ptsToPx(pageSizePts.widthPts, dpi);
            const pageHpx = ptsToPx(pageSizePts.heightPts, dpi);

            const chunks = buildChunkPlan(pageWpx, pageHpx, maxPixelsPerChunk, chunkOverlapPx);

            if (chunks.length > 1) {
                console.log(`  -> Página ${pageWpx}×${pageHpx}px | ${chunks.length} blocos de rasterização`);
            } else {
                console.log(`  -> Página ${pageWpx}×${pageHpx}px | bloco único (sem fatiamento)`);
            }

            for (let ci = 0; ci < chunks.length; ci++) {
                const chunk = chunks[ci];
                const chunkLabel = `${page}_${ci + 1}`;

                process.stdout.write(
                    `  -> Rasterizando bloco ${ci + 1}/${chunks.length} ` +
                    `(${Math.round(chunk.w)}×${Math.round(chunk.h)}px)...`
                );

                const rendered = popplerService.rasterizeRegion(
                    pdfPath,
                    page,
                    tempDir,
                    dpi,
                    chunk,
                    chunkLabel
                );

                console.log(` OK (${path.basename(rendered.filePath)})`);

                if (debugSavePng) {
                    const debugCopy = path.join(
                        debugDir,
                        `${baseName}_page_${page}_chunk_${ci + 1}.png`
                    );
                    fs.copyFileSync(rendered.filePath, debugCopy);
                    console.log(`  -> [Debug] PNG salvo: ${path.relative(process.cwd(), debugCopy)}`);
                }

                process.stdout.write(`  -> Extraindo do bloco ${ci + 1}/${chunks.length}...\n`);
                const chunkStartTime = Date.now();
                const detected = await extractor(rendered.filePath);
                const chunkElapsed = ((Date.now() - chunkStartTime) / 1000).toFixed(1);

                console.log(
                    `  -> Bloco ${ci + 1} concluído em ${chunkElapsed}s — ${detected.length} detecção(ões)`
                );

                for (const det of detected) {
                    const result = {
                        ...det,
                        page,
                    } as T & { page: number };

                    if ((det as any).globalCoordinates) {
                        const gc = (det as any).globalCoordinates;
                        (result as any).globalCoordinates = {
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