import os from 'os';

export interface DynamicLimits {
    cpuWorkers: number;
    memoryWorkers: number;
    ocrConcurrency: number;
    prefetchSize: number;
    sharpConcurrency: number;
    maxMemoryBytes: number;
    maxCpuUsagePercent: number;
}

export function getDynamicLimits(): DynamicLimits {
    const cpuCount = Math.max(1, os.cpus().length);
    const totalMemory = os.totalmem();

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

export function getOptimalConcurrency(): number {
    return getDynamicLimits().ocrConcurrency;
}