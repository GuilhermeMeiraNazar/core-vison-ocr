import * as fs from 'fs';
import * as path from 'path';

function findProjectRoot(): string {
    let dir = __dirname;

    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(dir, '.env'))) return dir;
        if (fs.existsSync(path.join(dir, 'package.json'))) return dir;

        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }

    return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();

function loadDotEnv(envPath: string): Record<string, string> {
    const vars: Record<string, string> = {};

    if (!fs.existsSync(envPath)) {
        console.log(`[Config] .env não encontrado em ${envPath} — usando defaults.`);
        return vars;
    }

    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;

        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();

        if (key && !(key in process.env)) {
            vars[key] = value;
        }
    }

    return vars;
}

const dotEnvVars = loadDotEnv(path.join(PROJECT_ROOT, '.env'));

function env(key: string, fallback: string): string {
    return process.env[key] ?? dotEnvVars[key] ?? fallback;
}

export function loadConfig() {
    return {
        dpi: parseInt(env('DPI', '600'), 10),
        tileSize: parseInt(env('TILE_SIZE', '2000'), 10),
        overlap: parseInt(env('OVERLAP', '200'), 10),
        dedupePx: parseInt(env('DEDUPE_PX', '60'), 10),

        chunkMaxRasterMb: parseInt(env('CHUNK_MAX_RASTER_MB', '1536'), 10),
        chunkOverlapPx: parseInt(env('CHUNK_OVERLAP_PX', '200'), 10),

        inputDir: path.resolve(PROJECT_ROOT, env('INPUT_DIR', './input')),
        outputDir: path.resolve(PROJECT_ROOT, env('OUTPUT_DIR', './output')),
        tempDir: path.resolve(PROJECT_ROOT, env('TEMP_DIR', './temp')),
        debugDir: path.resolve(PROJECT_ROOT, env('DEBUG_DIR', './debug')),

        debugSavePng: env('DEBUG_SAVE_PNG', 'false').toLowerCase() === 'true',
    };
}

export type AppConfig = ReturnType<typeof loadConfig>;