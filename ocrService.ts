import sharp from 'sharp';
import { OcrPaths } from './ocrPaths';
import { AsyncQueue } from './asyncQueue';
import { analyzeBlankness, preprocessTileBuffer, TileRotation } from './imageUtils';
import { getDynamicLimits } from './resourceManager';

const DEBUG_OCR_RAW = false;
const DEBUG_OCR_TILES = 2;

sharp.cache(false);

export interface DetectedTag {
    tag: string;
    confidence: number;
    globalCoordinates: {
        centerX: number;
        centerY: number;
        xMin: number;
        yMin: number;
        xMax: number;
        yMax: number;
    };
}

export interface TileConfig {
    tileSize: number;
    overlap: number;
    dedupeProximityPx: number;
}

interface TileJob {
    xOff: number;
    yOff: number;
    tileW: number;
    tileH: number;
    tileIndex: number;
    tileTotal: number;
}

interface ProcessedTile {
    job: TileJob;
    rotation: TileRotation;
    buffer: Buffer;
}

const TAG_REGEX = /^=?[A-Z]-\d{3,}$/;

function isValidTag(text: string): boolean {
    if (!text || text.trim().length < 4) return false;
    return TAG_REGEX.test(text.trim().toUpperCase());
}

function normalizeTag(text: string): string {
    return text.trim().toUpperCase();
}

export class OcrService {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private ocrEngine: any = null;
    private paths: OcrPaths;
    private tileConfig: TileConfig = {
        tileSize: 1200,
        overlap: 300,
        dedupeProximityPx: 60,
    };

    constructor(paths: OcrPaths, config?: Partial<TileConfig>) {
        this.paths = paths;
        if (config) {
            this.tileConfig = { ...this.tileConfig, ...config };
        }
    }

    public async init(): Promise<void> {
        const limits = getDynamicLimits();
        sharp.concurrency(limits.sharpConcurrency);

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const lib = require('multilingual-purejs-ocr');

        const OcrClass = lib.Ocr ?? lib.default?.Ocr ?? lib.default;
        const baseConfig = lib.DEFAULT_CONFIG;

        if (!OcrClass || typeof OcrClass.create !== 'function') {
            throw new Error('[OCR] Ocr.create() nao encontrado na biblioteca.');
        }

        const detPath = this.paths.modelPath('ch_PP-OCRv4_det_infer.onnx');
        const recPath = this.paths.modelPath('en_PP-OCRv4_rec_infer.onnx');
        const dictPath = this.paths.modelPath('en_dict.txt');

        console.log('[OCR] Modelos que serao usados:');
        console.log('  det :', detPath);
        console.log('  rec :', recPath);
        console.log('  dict:', dictPath);

        baseConfig.DETECTION.MODEL_PATH = detPath;
        baseConfig.RECOGNITION.LANGUAGES['en'].MODEL = recPath;
        baseConfig.RECOGNITION.LANGUAGES['en'].DICT = dictPath;
        baseConfig.RECOGNITION.DEFAULT_LANGUAGE = 'en';
        baseConfig.RECOGNITION.CONFIDENCE_THRESHOLD = 0.2;
        baseConfig.DETECTION.THRESHOLD = 0.05;
        baseConfig.DETECTION.UNCLIP_RATIO = 2.0;
        baseConfig.DETECTION.MIN_BOX_SIZE = 2;
        baseConfig.DETECTION.MAX_IMAGE_SIZE = 1920;

        console.log('[OCR] Chamando Ocr.create()...');
        this.ocrEngine = await OcrClass.create({ language: 'en' });
        console.log('[OCR] Ocr.create() concluido — servico pronto!');
    }

    public async getImageDimensions(imagePath: string): Promise<{ width: number; height: number }> {
        const meta = await sharp(imagePath, { limitInputPixels: false }).metadata();
        return { width: meta.width ?? 1, height: meta.height ?? 1 };
    }

    private buildTileJobs(imgW: number, imgH: number): TileJob[] {
        const { tileSize, overlap } = this.tileConfig;
        const step = tileSize - overlap;
        const jobs: TileJob[] = [];

        let tileIndex = 0;
        let tileTotal = 0;

        for (let y = 0; y < imgH; y += step) {
            for (let x = 0; x < imgW; x += step) {
                const tileW = Math.min(tileSize, imgW - x);
                const tileH = Math.min(tileSize, imgH - y);
                if (tileW <= 0 || tileH <= 0) continue;
                tileTotal++;
            }
        }

        for (let yOff = 0; yOff < imgH; yOff += step) {
            for (let xOff = 0; xOff < imgW; xOff += step) {
                const tileW = Math.min(tileSize, imgW - xOff);
                const tileH = Math.min(tileSize, imgH - yOff);
                if (tileW <= 0 || tileH <= 0) continue;

                tileIndex++;
                jobs.push({ xOff, yOff, tileW, tileH, tileIndex, tileTotal });
            }
        }

        return jobs;
    }

    private async produceTiles(
        imagePath: string,
        jobs: TileJob[],
        queue: AsyncQueue<ProcessedTile>,
        prefetchSize: number
    ): Promise<void> {
        const rotations: TileRotation[] = ['none', 'cw90']; // somente horizontal e vertical
        const maxInFlight = Math.max(1, prefetchSize);

        let cursor = 0;
        const inFlight = new Set<Promise<void>>();

        const launch = async (job: TileJob): Promise<void> => {
            console.log(`[OCR] Bloco ${job.tileIndex}/${job.tileTotal} @ (${job.xOff},${job.yOff}) -> extraindo`);

            const tileBuffer = await sharp(imagePath, { limitInputPixels: false })
                .extract({
                    left: job.xOff,
                    top: job.yOff,
                    width: job.tileW,
                    height: job.tileH,
                })
                .png({ compressionLevel: 1 })
                .toBuffer();

            const blank = await analyzeBlankness(tileBuffer);
            if (blank.isBlank) {
                console.log(`[OCR] Bloco ${job.tileIndex}/${job.tileTotal} @ (${job.xOff},${job.yOff}) -> branco descartado`);
                return;
            }

            for (const rotation of rotations) {
                const processed = await preprocessTileBuffer(tileBuffer, rotation);
                queue.enqueue({
                    job,
                    rotation,
                    buffer: processed,
                });
            }
        };

        while (cursor < jobs.length || inFlight.size > 0) {
            while (cursor < jobs.length && inFlight.size < maxInFlight) {
                const job = jobs[cursor++];
                const p = launch(job).catch(() => undefined).finally(() => {
                    inFlight.delete(p);
                });
                inFlight.add(p);
            }

            if (inFlight.size > 0) {
                await Promise.race([...inFlight]);
            }
        }

        queue.close();
    }

    private async consumeTiles(
        queue: AsyncQueue<ProcessedTile>,
        rawDetections: DetectedTag[]
    ): Promise<void> {
        let debugLogged = 0;
        const seenHorizontalTags = new Set<string>();

        while (true) {
            const item = await queue.dequeue();
            if (!item) break;

            const { job, rotation, buffer } = item;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let ocrResult: any = null;
            try {
                ocrResult = await this.ocrEngine.detect(buffer, { grouped: false });
            } catch {
                console.log(`[OCR] Bloco ${job.tileIndex}/${job.tileTotal} @ (${job.xOff},${job.yOff}) -> OCR erro`);
                continue;
            }

            console.log(`[OCR] Bloco ${job.tileIndex}/${job.tileTotal} @ (${job.xOff},${job.yOff}) -> OCR ok (${rotation})`);

            if (DEBUG_OCR_RAW && debugLogged < DEBUG_OCR_TILES) {
                debugLogged++;
                console.log(`\n  [DEBUG] Tile ${job.tileIndex} (${rotation}) resultado bruto:`);
                try {
                    console.log(JSON.stringify(ocrResult, null, 2).substring(0, 3000));
                } catch {
                    console.log(String(ocrResult).substring(0, 1000));
                }
                console.log('  [DEBUG] ---');
            }

            if (!ocrResult?.data) continue;

            for (const itemDet of ocrResult.data) {
                const rawText = String(itemDet?.text ?? '').trim();
                if (!isValidTag(rawText)) continue;

                const tag = normalizeTag(rawText);

                // 1) Se foi achada na horizontal, guarda
                // 2) Se aparecer na vertical e já existir, ignora
                if (rotation === 'none') {
                    seenHorizontalTags.add(tag);
                } else if (seenHorizontalTags.has(tag)) {
                    continue;
                }

                const confidence = Number(itemDet?.confidence ?? 0);

                let xMinLocal = 0;
                let yMinLocal = 0;
                let xMaxLocal = 0;
                let yMaxLocal = 0;

                if (itemDet?.frame) {
                    xMinLocal = Number(itemDet.frame.left ?? 0);
                    yMinLocal = Number(itemDet.frame.top ?? 0);
                    xMaxLocal = xMinLocal + Number(itemDet.frame.width ?? 0);
                    yMaxLocal = yMinLocal + Number(itemDet.frame.height ?? 0);
                } else if (Array.isArray(itemDet?.box) && itemDet.box.length >= 2) {
                    const xs = itemDet.box.map((pt: any) => Number(pt[0]));
                    const ys = itemDet.box.map((pt: any) => Number(pt[1]));
                    xMinLocal = Math.min(...xs);
                    xMaxLocal = Math.max(...xs);
                    yMinLocal = Math.min(...ys);
                    yMaxLocal = Math.max(...ys);
                }

                const mapped = this.mapRotatedCoordinates(
                    rotation,
                    job.xOff,
                    job.yOff,
                    job.tileW,
                    job.tileH,
                    xMinLocal,
                    yMinLocal,
                    xMaxLocal,
                    yMaxLocal
                );

                rawDetections.push({
                    tag,
                    confidence,
                    globalCoordinates: mapped,
                });
            }
        }
    }

    public async processImage(imagePath: string): Promise<DetectedTag[]> {
        if (!this.ocrEngine) {
            throw new Error('[OCR] Motor nao inicializado. Chame init() antes de processImage().');
        }

        const meta = await sharp(imagePath, { limitInputPixels: false }).metadata();
        const imgW = meta.width;
        const imgH = meta.height;

        if (!imgW || !imgH) {
            throw new Error(`[OCR] Nao foi possivel ler dimensoes de: ${imagePath}`);
        }

        const limits = getDynamicLimits();
        const jobs = this.buildTileJobs(imgW, imgH);
        const rawDetections: DetectedTag[] = [];
        const queue = new AsyncQueue<ProcessedTile>();

        console.log(
            `  [OCR] Fatiando em ~${jobs.length} blocos de ${this.tileConfig.tileSize}x${this.tileConfig.tileSize}px (overlap ${this.tileConfig.overlap}px)`
        );
        console.log(
            `  [OCR] Concorrencia: ${limits.ocrConcurrency} | Prefetch RAM: ${limits.prefetchSize}`
        );

        await Promise.all([
            this.produceTiles(imagePath, jobs, queue, limits.prefetchSize),
            this.consumeTiles(queue, rawDetections),
        ]);

        return this.dedupeDetections(rawDetections);
    }

    // Público porque o index.ts também precisa deduplicar detecções entre
    // blocos vizinhos depois de remapeá-las para o espaço global da página
    // (cada bloco já deduplica internamente, mas uma tag perto da borda de
    // dois blocos pode aparecer em ambos por causa da sobreposição).
    public dedupeDetections(detections: DetectedTag[]): DetectedTag[] {
        const { dedupeProximityPx } = this.tileConfig;
        const result: DetectedTag[] = [];

        for (const det of detections) {
            const exists = result.some(prev => {
                const dx = prev.globalCoordinates.centerX - det.globalCoordinates.centerX;
                const dy = prev.globalCoordinates.centerY - det.globalCoordinates.centerY;
                return Math.sqrt(dx * dx + dy * dy) <= dedupeProximityPx && prev.tag === det.tag;
            });

            if (!exists) result.push(det);
        }

        return result;
    }

    private mapRotatedCoordinates(
        rotation: TileRotation,
        xOff: number,
        yOff: number,
        tileW: number,
        tileH: number,
        xMinLocal: number,
        yMinLocal: number,
        xMaxLocal: number,
        yMaxLocal: number
    ) {
        return {
            centerX: xOff + (xMinLocal + xMaxLocal) / 2,
            centerY: yOff + (yMinLocal + yMaxLocal) / 2,
            xMin: xOff + xMinLocal,
            yMin: yOff + yMinLocal,
            xMax: xOff + xMaxLocal,
            yMax: yOff + yMaxLocal,
        };
    }
}