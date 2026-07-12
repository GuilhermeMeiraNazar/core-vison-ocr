"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeBlankness = analyzeBlankness;
exports.preprocessTileBuffer = preprocessTileBuffer;
const sharp_1 = __importDefault(require("sharp"));
async function analyzeBlankness(input, threshold = 245, minWhiteRatio = 0.999) {
    const { data, info } = await (0, sharp_1.default)(input, { limitInputPixels: false })
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
    let sum = 0;
    let whiteCount = 0;
    for (let i = 0; i < data.length; i++) {
        const v = data[i];
        sum += v;
        if (v >= threshold)
            whiteCount++;
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
async function preprocessTileBuffer(input, rotation) {
    let img = (0, sharp_1.default)(input, { limitInputPixels: false });
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
//# sourceMappingURL=imageUtils.js.map