import * as fs from 'fs';
import * as path from 'path';

export class PopplerPaths {
    public readonly varPath: string;
    public readonly popplerPath: string;

    constructor() {
        this.varPath = path.resolve(process.cwd(), 'var');
        this.popplerPath = path.join(this.varPath, 'poppler');

        if (!fs.existsSync(this.varPath)) fs.mkdirSync(this.varPath, { recursive: true });
    }

    /** Localiza um executável dentro da pasta do poppler (fixo ou busca recursiva). */
    public findBin(name: string): string | null {
        // Caminho fixo (estrutura atual do zip do oschwartz)
        const fixed = path.join(this.popplerPath, 'Library', 'bin', name);
        if (fs.existsSync(fixed)) return fixed;

        // Busca dinâmica: percorre subpastas
        return this.findFile(this.popplerPath, name);
    }

    private findFile(dir: string, name: string): string | null {
        if (!fs.existsSync(dir)) return null;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const found = this.findFile(full, name);
                if (found) return found;
            } else if (entry.name === name) {
                return full;
            }
        }
        return null;
    }
}
