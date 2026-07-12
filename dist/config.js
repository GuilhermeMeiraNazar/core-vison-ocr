"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function findProjectRoot() {
    let dir = __dirname;
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(dir, '.env')))
            return dir;
        if (fs.existsSync(path.join(dir, 'package.json')))
            return dir;
        const parent = path.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return process.cwd();
}
const PROJECT_ROOT = findProjectRoot();
function loadDotEnv(envPath) {
    const vars = {};
    if (!fs.existsSync(envPath)) {
        console.log(`[Config] .env não encontrado em ${envPath} — usando defaults.`);
        return vars;
    }
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#'))
            continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1)
            continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (key && !(key in process.env)) {
            vars[key] = value;
        }
    }
    return vars;
}
const dotEnvVars = loadDotEnv(path.join(PROJECT_ROOT, '.env'));
function env(key, fallback) {
    return process.env[key] ?? dotEnvVars[key] ?? fallback;
}
function loadConfig() {
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
//# sourceMappingURL=config.js.map