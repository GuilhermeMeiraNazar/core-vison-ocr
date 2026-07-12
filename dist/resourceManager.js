"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDynamicLimits = getDynamicLimits;
exports.getOptimalConcurrency = getOptimalConcurrency;
const os_1 = __importDefault(require("os"));
function getDynamicLimits() {
    const cpuCount = Math.max(1, os_1.default.cpus().length);
    const totalMemory = os_1.default.totalmem();
    const maxCpuUsagePercent = 0.60;
    const cpuWorkers = Math.max(1, Math.floor(cpuCount * maxCpuUsagePercent));
    const maxMemoryBytes = Math.floor(totalMemory * maxCpuUsagePercent);
    const approxBytesPerWorker = 512 * 1024 * 1024;
    const memoryWorkers = Math.max(1, Math.floor(maxMemoryBytes / approxBytesPerWorker));
    const ocrConcurrency = Math.max(1, Math.min(cpuWorkers, memoryWorkers));
    const prefetchSize = Math.max(5, ocrConcurrency * 2);
    const sharpConcurrency = Math.max(1, Math.min(cpuWorkers, 4));
    return {
        cpuWorkers,
        memoryWorkers,
        ocrConcurrency,
        prefetchSize,
        sharpConcurrency,
        maxMemoryBytes,
        maxCpuUsagePercent: 60,
    };
}
function getOptimalConcurrency() {
    return getDynamicLimits().ocrConcurrency;
}
//# sourceMappingURL=resourceManager.js.map