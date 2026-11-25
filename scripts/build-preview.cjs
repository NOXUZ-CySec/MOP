"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const ui = path.join(root, "ui-next");
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") {
  console.log("Usage: node scripts/build-preview.cjs [--target nsis|portable]\nDefault: NSIS and portable Windows x64, with typecheck and UI build. Publishing is always disabled.");
  process.exit(0);
}
if (args.length && !(args.length === 2 && args[0] === "--target" && ["nsis", "portable"].includes(args[1]))) {
  console.error("Invalid arguments. Use --help. Publishing options are not accepted by this command.");
  process.exit(2);
}
if (process.platform !== "win32") {
  console.error("Build the Windows preview on Windows x64. This command does not install Wine or Docker.");
  process.exit(2);
}
const targets = args.length ? [args[1]] : ["nsis", "portable"];
function bin(project, packageName, command) {
  const directory = path.join(project, "node_modules", ...packageName.split("/"));
  const metadataFile = path.join(directory, "package.json");
  if (!fs.existsSync(metadataFile)) throw new Error("Missing " + packageName + "; install the locked dependencies first (see BUILDING.md).");
  const metadata = JSON.parse(fs.readFileSync(metadataFile, "utf8"));
  const relative = typeof metadata.bin === "string" ? metadata.bin : metadata.bin?.[command];
  if (!relative) throw new Error("CLI entry missing for " + packageName);
  return path.resolve(directory, relative);
}
function run(label, script, argv, cwd = root) {
  console.log("[MOP] " + label);
  const result = spawnSync(process.execPath, [script, ...argv], { cwd, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(label + " failed" + (result.signal ? " (" + result.signal + ")" : "."));
    error.exitCode = result.status || 1;
    throw error;
  }
}
try {
  run("Exporting canonical preview configuration", path.join(__dirname, "export-preview-config.cjs"), []);
  run("Checking TypeScript", bin(ui, "typescript", "tsc"), ["--noEmit"], ui);
  run("Building the application UI", bin(ui, "vite", "vite"), ["build"], ui);
  run("Packaging Windows preview (publish: never)", bin(root, "electron-builder", "electron-builder"), ["--config", "electron-builder-preview.cjs", "--win", ...targets, "--x64", "--publish", "never"]);
  const config = require(path.join(root, "electron-builder-preview.cjs"));
  const output = path.join(root, config.directories.output);
  if (targets.includes("nsis")) {
    const latest = path.join(output, "latest.yml");
    const preview = path.join(output, "preview.yml");
    if (fs.existsSync(latest)) fs.copyFileSync(latest, preview);
    else if (fs.existsSync(preview)) fs.copyFileSync(preview, latest);
    else throw new Error("Installer build did not produce updater metadata.");
  }
  console.log("[MOP] Local preview artifacts: " + output);
  console.log("[MOP] Publication and operational validation are separate steps.");
} catch (error) {
  console.error("[MOP] " + error.message);
  process.exitCode = error.exitCode || 1;
}
