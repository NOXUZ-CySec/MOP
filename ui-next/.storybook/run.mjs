import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = path.join(root, "node_modules/storybook/package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const binary = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.storybook;
const child = spawn(process.execPath, [path.resolve(path.dirname(pkgPath), binary), ...process.argv.slice(2), "--disable-telemetry"], {
 cwd: root, stdio: "inherit", env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: "1" },
});
child.on("exit", code => { process.exitCode = code ?? 1; });
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
