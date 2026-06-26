import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const outDir = path.join(rootDir, "scratch", "patcher-tests");
const tscBin = path.join(rootDir, "node_modules", "typescript", "bin", "tsc");

fs.rmSync(outDir, { recursive: true, force: true });
execFileSync(process.execPath, [tscBin, "-p", "tsconfig.patcher-tests.json"], {
    cwd: rootDir,
    stdio: "inherit",
});

rewriteAliases(path.join(outDir, "src", "lib"));

execFileSync(process.execPath, [path.join(outDir, "scripts", "patcher-smoke-tests.js")], {
    cwd: rootDir,
    stdio: "inherit",
});

function rewriteAliases(dir) {
    if (!fs.existsSync(dir)) return;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            rewriteAliases(fullPath);
            continue;
        }

        if (!entry.name.endsWith(".js")) continue;
        const source = fs.readFileSync(fullPath, "utf8");
        const updated = source.replace(/require\("@\/lib\/([^"]+)"\)/g, 'require("./$1")');
        fs.writeFileSync(fullPath, updated, "utf8");
    }
}
