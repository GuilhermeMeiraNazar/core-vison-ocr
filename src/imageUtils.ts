import sharp from 'sharp';

export type TileRotation = 'none' | 'cw90';

export interface BlankAnalysis {
    isBlank: boolean;
    whiteRatio: number;
    avgBrightness: number;
}

export async function analyzeBlankness(
    input: Buffer,
    threshold = 245,
    minWhiteRatio = 0.999
): Promise<BlankAnalysis> {
    const { data, info } = await sharp(input, { limitInputPixels: false })
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

    let sum = 0;
    let whiteCount = 0;

    for (let i = 0; i < data.length; i++) {
        const v = data[i];
        sum += v;
        if (v >= threshold) whiteCount++;
    }

    const pixelCount = Math.max(1, info.width * info.height);
    const avgBrightness = sum / pixelCount;
    const whiteRatio = whiteCount / pixelCount;

    return {
        isBlank: whiteRatio >= minWhiteRatio && avgBrightness >= threshold,
        whiteRatio,
        avgBrightness,
    };
}

export async function preprocessTileBuffer(
    input: Buffer,
    rotation: TileRotation
): Promise<Buffer> {
    let img = sharp(input, { limitInputPixels: false });

    if (rotation === 'cw90') {
        img = img.rotate(90);
    }

    return img
        .greyscale()
        .normalize()
        .sharpen()
        .linear(1.5, -(128 * 1.5) + 128)
        .threshold(145)
        .png({ compressionLevel: 1 })
        .toBuffer();
}