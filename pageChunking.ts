/**
 * Utilitários para fatiar uma página de PDF em blocos (chunks) de pixels
 * que cabem com segurança na memória que o Poppler consegue alocar.
 */

export interface PixelRegion {
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * Converte pontos PDF (1/72 polegada) para pixels num DPI alvo.
 * Usa o mesmo arredondamento (ceil) que o pdftoppm usa internamente —
 * validado comparando com a saída real do Poppler (ex.: página de
 * 10111x2384 pts a 300 DPI gera exatamente 42130x9934 px, que é
 * ceil(10111/72*300) x ceil(2384/72*300)).
 */
export function ptsToPx(pts: number, dpi: number): number {
    return Math.ceil((pts / 72) * dpi);
}

/**
 * Escolhe a largura/altura de bloco que maximizam a área renderizada por
 * chamada ao Poppler sem ultrapassar `maxPixels` (largura × altura).
 * Sempre que uma dimensão da página já cabe inteira dentro do orçamento,
 * ela é mantida cheia — é por isso que uma página "faixa larga" (baixa e
 * comprida, como um desenho DIN 3xA0) acaba sendo fatiada só no eixo X,
 * com a altura inteira em cada bloco.
 */
function chooseChunkDims(
    totalW: number,
    totalH: number,
    maxPixels: number
): { w: number; h: number } {
    if (totalW * totalH <= maxPixels) {
        return { w: totalW, h: totalH };
    }

    const ideal = Math.floor(Math.sqrt(maxPixels));
    let chunkW = Math.min(totalW, ideal);
    let chunkH = Math.min(totalH, ideal);

    if (chunkW < ideal) {
        // a largura da página é o fator limitante: usa o orçamento que
        // sobrou na altura
        chunkH = Math.min(totalH, Math.floor(maxPixels / chunkW));
    } else if (chunkH < ideal) {
        // a altura da página é o fator limitante (caso comum em desenhos
        // "faixa larga"): usa o orçamento que sobrou na largura
        chunkW = Math.min(totalW, Math.floor(maxPixels / chunkH));
    }

    return { w: Math.max(1, chunkW), h: Math.max(1, chunkH) };
}

/**
 * Gera os offsets de um eixo (0, step, 2*step, ...) cobrindo `total` px
 * com blocos de `chunkSize` e sobreposição `overlap`, sem gerar um bloco
 * final redundante quando o penúltimo já alcança o fim do eixo.
 */
function buildAxisOffsets(total: number, chunkSize: number, overlap: number): number[] {
    if (chunkSize >= total) return [0];

    const step = Math.max(1, chunkSize - overlap);
    const offsets: number[] = [];

    let o = 0;
    while (o < total) {
        offsets.push(o);
        if (o + chunkSize >= total) break;
        o += step;
    }

    return offsets;
}

/**
 * Monta a grade de blocos que cobre toda a página, com sobreposição entre
 * blocos vizinhos — isso garante que nenhuma tag fique cortada bem na
 * fronteira entre dois blocos sem aparecer inteira em pelo menos um deles.
 * Tags duplicadas perto da fronteira são removidas depois, no índice
 * (ver `OcrService.dedupeDetections`).
 *
 * Quando a página inteira já cabe no orçamento de memória, retorna um
 * único bloco cobrindo a página inteira (x:0, y:0, w:pageWidthPx,
 * h:pageHeightPx) — ou seja, PDFs pequenos continuam se comportando
 * exatamente como antes, só que passando pelo mesmo caminho de código
 * validado.
 */
export function buildChunkPlan(
    pageWidthPx: number,
    pageHeightPx: number,
    maxPixels: number,
    overlapPx: number
): PixelRegion[] {
    const { w: chunkW, h: chunkH } = chooseChunkDims(pageWidthPx, pageHeightPx, maxPixels);

    const xOffsets = buildAxisOffsets(pageWidthPx, chunkW, overlapPx);
    const yOffsets = buildAxisOffsets(pageHeightPx, chunkH, overlapPx);

    const regions: PixelRegion[] = [];
    for (const y of yOffsets) {
        const h = Math.min(chunkH, pageHeightPx - y);
        for (const x of xOffsets) {
            const w = Math.min(chunkW, pageWidthPx - x);
            regions.push({ x, y, w, h });
        }
    }

    return regions;
}