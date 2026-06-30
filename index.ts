import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from './config';
import { PopplerPaths } from './popplerPaths';
import { PopplerInstaller } from './popplerInstaller';
import { PopplerService } from './popplerService';
import { OcrPaths } from './ocrPaths';
import { OcrInstaller } from './ocrInstaller';
import { OcrService } from './ocrService';
import { PdfPipeline } from './pdfPipeline';

const cfg = loadConfig();

interface TagResult {
    tag: string;
    confidence: number;
    x: number;
    y: number;
    page: number;
}

async function run(): Promise<void> {
    console.log('');
    console.log('==========================================');
    console.log(' Core Vision OCR');
    console.log('==========================================');
    console.log('');

    fs.mkdirSync(cfg.outputDir, { recursive: true });
    fs.mkdirSync(cfg.tempDir, { recursive: true });
    fs.mkdirSync(cfg.inputDir, { recursive: true });
    if (cfg.debugSavePng) fs.mkdirSync(cfg.debugDir, { recursive: true });

    console.log(
        `[Config] DPI: ${cfg.dpi} | Tile: ${cfg.tileSize}px | Overlap: ${cfg.overlap}px | ` +
        `Chunk budget: ${cfg.chunkMaxRasterMb}MB | Debug PNG: ${cfg.debugSavePng ? 'ON' : 'OFF'}`
    );
    console.log('[Setup] Verificando Poppler e OCR...');

    const popplerPaths = new PopplerPaths();
    const popplerInstaller = new PopplerInstaller(popplerPaths);
    const popplerService = new PopplerService(popplerPaths);

    const ocrPaths = new OcrPaths();
    const ocrInstaller = new OcrInstaller(ocrPaths);
    const ocrService = new OcrService(ocrPaths, {
        tileSize: cfg.tileSize,
        overlap: cfg.overlap,
        dedupeProximityPx: cfg.dedupePx,
    });

    await Promise.all([
        popplerInstaller.install(),
        ocrInstaller.install(),
    ]);

    await ocrService.init();

    const pipeline = new PdfPipeline({
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

        const allTags: TagResult[] = await pipeline.extractTagsFromPdf(pdfPath, baseName);

        const outputPath = path.join(cfg.outputDir, `${baseName}_tags.json`);
        fs.writeFileSync(outputPath, JSON.stringify(allTags, null, 2), 'utf8');
        console.log(`\n[Output] JSON salvo em: ${path.relative(process.cwd(), outputPath)}`);

        if (allTags.length === 0) {
            console.log('[Resultado] Nenhuma tag encontrada neste PDF.');
        } else {
            const uniqueTags = [...new Set(allTags.map(t => t.tag))].sort();
            console.log(
                `[Resultado] ${allTags.length} tags detectadas (${uniqueTags.length} únicas): ${uniqueTags.join(', ')}`
            );
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