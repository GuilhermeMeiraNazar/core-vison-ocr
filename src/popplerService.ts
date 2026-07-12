import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { PopplerPaths } from './popplerPaths';

/**
 * Lê width/height direto do chunk IHDR do PNG (8 bytes fixos no offset 16),
 * sem depender de nenhuma lib de imagem — é só o cabeçalho do arquivo, e
 * essa posição é fixa pela especificação do PNG independente do tipo de
 * cor/compressão usado. Usado só pra validar que o pdftoppm gerou um PNG
 * de verdade, e não o "PNG fantasma" de 1x1px do bug de alocação.
 */
function readPngDimensions(filePath: string): { width: number; height: number } {
    const fd = fs.openSync(filePath, 'r');
    try {
        const header = Buffer.alloc(24);
        fs.readSync(fd, header, 0, 24, 0);
        return {
            width: header.readUInt32BE(16),
            height: header.readUInt32BE(20),
        };
    } finally {
        fs.closeSync(fd);
    }
}

export class PopplerService {
    private paths: PopplerPaths;

    constructor(paths: PopplerPaths = new PopplerPaths()) {
        this.paths = paths;
    }

    // ── Caminho do executável principal ───────────────────────────
    public getBinPath(): string {
        const bin = this.paths.findBin('pdftoppm.exe');
        if (!bin) {
            throw new Error(
                '[Poppler] pdftoppm.exe não encontrado em ' + this.paths.popplerPath +
                '\nVerifique se o Poppler foi instalado (rode o PopplerInstaller).'
            );
        }
        return bin;
    }

    // ── Rasteriza uma página do PDF em PNG (página inteira de uma vez) ──
    // ⚠️ Em páginas muito grandes + DPI alto isso pode exigir um bitmap
    // maior do que o Poppler consegue alocar. Quando isso acontece, o
    // pdftoppm às vezes termina com exit code 0 mesmo assim, mas grava um
    // PNG de 1x1px no lugar (procure "Bogus memory allocation size" no
    // stderr). Pra páginas grandes, use rasterizeRegion() abaixo — o
    // pipeline em index.ts já faz isso automaticamente via buildChunkPlan().
    public rasterizePage(
        pdfPath: string,
        pageNum: number,
        tempDir: string,
        dpi: number = 600
    ): string {
        fs.mkdirSync(tempDir, { recursive: true });

        const binPath = this.getBinPath();
        const prefix = path.join(tempDir, `page_${pageNum}`);

        const result = spawnSync(binPath, [
            '-png',
            '-r', String(dpi),
            '-f', String(pageNum),
            '-l', String(pageNum),
            pdfPath,
            prefix
        ], { encoding: 'utf8', timeout: 60_000 });

        if (result.status !== 0) {
            throw new Error(
                `[Poppler] pdftoppm falhou na página ${pageNum}:\n${result.stderr || result.error?.message}`
            );
        }

        // pdftoppm gera com zero-padding: page_1-1.png ou page_1-01.png
        const files = fs.readdirSync(tempDir)
            .filter(f => f.startsWith(`page_${pageNum}-`) && f.endsWith('.png'))
            .sort();

        if (files.length === 0) {
            const altFiles = fs.readdirSync(tempDir)
                .filter(f => f.startsWith(`page_${pageNum}`) && f.endsWith('.png'))
                .sort();
            if (altFiles.length === 0) {
                throw new Error(`[Poppler] Nenhum PNG gerado para a página ${pageNum}`);
            }
            return path.join(tempDir, altFiles[altFiles.length - 1]);
        }

        return path.join(tempDir, files[files.length - 1]);
    }

    // ── Rasteriza só uma região (crop) da página, no DPI final ─────────
    // O recorte é feito diretamente a partir do PDF vetorial via -x/-y/-W/-H
    // do pdftoppm — NÃO é um crop em cima de um PNG já rasterizado. Por
    // isso não existe nenhuma perda de qualidade comparado a renderizar a
    // página inteira de uma vez: cada pixel do resultado é idêntico ao que
    // sairia de um render full-page bem-sucedido nesse mesmo DPI.
    public rasterizeRegion(
        pdfPath: string,
        pageNum: number,
        tempDir: string,
        dpi: number,
        region: { x: number; y: number; w: number; h: number },
        chunkLabel: string
    ): { filePath: string; width: number; height: number } {
        fs.mkdirSync(tempDir, { recursive: true });

        const binPath = this.getBinPath();
        const prefix = path.join(tempDir, `chunk_${chunkLabel}_page_${pageNum}`);
        const prefixBase = path.basename(prefix);

        const result = spawnSync(binPath, [
            '-png',
            '-r', String(dpi),
            '-x', String(Math.round(region.x)),
            '-y', String(Math.round(region.y)),
            '-W', String(Math.round(region.w)),
            '-H', String(Math.round(region.h)),
            '-f', String(pageNum),
            '-l', String(pageNum),
            pdfPath,
            prefix
        ], { encoding: 'utf8', timeout: 120_000 });

        if (result.status !== 0) {
            throw new Error(
                `[Poppler] pdftoppm falhou no bloco "${chunkLabel}" da página ${pageNum}:\n` +
                `${result.stderr || result.error?.message}`
            );
        }

        const files = fs.readdirSync(tempDir)
            .filter(f => f.startsWith(`${prefixBase}-`) && f.endsWith('.png'))
            .sort();

        if (files.length === 0) {
            throw new Error(
                `[Poppler] Nenhum PNG gerado para o bloco "${chunkLabel}" da página ${pageNum}.\n` +
                `stderr: ${result.stderr}`
            );
        }

        const filePath = path.join(tempDir, files[files.length - 1]);
        const dims = readPngDimensions(filePath);

        // ── Validação crítica — é isso que elimina o "erro silencioso" ──
        // Se o bloco saiu com 1x1px (ou qualquer coisa absurdamente menor
        // que o pedido), o pdftoppm reportou status 0 mas a alocação de
        // memória falhou internamente. Em vez de deixar esse PNG corrompido
        // seguir pro OCR — que simplesmente não acharia nenhuma tag ali,
        // sem avisar nada — lançamos um erro claro e acionável.
        if (dims.width <= 1 || dims.height <= 1) {
            throw new Error(
                `[Poppler] Bloco "${chunkLabel}" da página ${pageNum} saiu corrompido ` +
                `(${dims.width}x${dims.height}px, esperado ~${Math.round(region.w)}x${Math.round(region.h)}px).\n` +
                `Isso indica que o bloco ainda é grande demais pro Poppler alocar em memória ` +
                `nesse DPI (procure "Bogus memory allocation size" no log acima). ` +
                `Reduza CHUNK_MAX_RASTER_MB em index.ts e tente novamente.`
            );
        }

        return { filePath, width: dims.width, height: dims.height };
    }

    // ── Tamanho da página em pontos PDF (1/72 polegada) ─────────────────
    // Usado pra calcular o tamanho em pixels no DPI alvo SEM precisar
    // renderizar nada antes — é o que permite montar o plano de blocos
    // (buildChunkPlan) antes de qualquer chamada cara ao pdftoppm.
    //
    // O pdfinfo gera saída no formato: "Page    1 size:  10111 x 2384 pts"
    // (com o número da página entre "Page" e "size"). O regex leva isso
    // em conta e aceita qualquer quantidade de espaços entre os tokens.
    public getPageSizePts(pdfPath: string, pageNum: number): { widthPts: number; heightPts: number } {
        const pdfInfoBin = this.paths.findBin('pdfinfo.exe');
        if (!pdfInfoBin) {
            throw new Error(
                '[Poppler] pdfinfo.exe não encontrado em ' + this.paths.popplerPath
            );
        }

        const result = spawnSync(pdfInfoBin, [
            '-f', String(pageNum),
            '-l', String(pageNum),
            pdfPath
        ], { encoding: 'utf8', timeout: 10_000 });

        // Aceita "Page    1 size:" (formato real do pdfinfo com -f/-l)
        const match = result.stdout?.match(/Page\s+\d+\s+size:\s+([\d.]+)\s*x\s*([\d.]+)\s*pts/i);
        if (!match) {
            throw new Error(
                `[Poppler] Não foi possível ler o tamanho da página ${pageNum} via pdfinfo.\n` +
                `stdout: ${result.stdout}\nstderr: ${result.stderr}`
            );
        }

        return {
            widthPts: parseFloat(match[1]),
            heightPts: parseFloat(match[2]),
        };
    }

    // ── Retorna o total de páginas via pdfinfo ────────────────────
    public getPageCount(pdfPath: string): number {
        const pdfInfoBin = this.paths.findBin('pdfinfo.exe');
        if (!pdfInfoBin) return 1; // fallback seguro

        const result = spawnSync(pdfInfoBin, [pdfPath], {
            encoding: 'utf8',
            timeout: 10_000
        });

        const match = result.stdout?.match(/Pages:\s+(\d+)/);
        return match ? parseInt(match[1], 10) : 1;
    }
}