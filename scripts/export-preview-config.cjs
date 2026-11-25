"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const pkg = require(path.join(root, "package.json"));
const config = require(path.join(root, "electron-builder-preview.cjs"));
const args = process.argv.slice(2);
if (args.some(arg => arg !== "--check") || args.length > 1) {
  console.error("Usage: node scripts/export-preview-config.cjs [--check]");
  process.exit(2);
}
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
assert.equal(lock.version, pkg.version, "Root package-lock version is stale");
assert.equal(lock.packages[""].version, pkg.version, "Root lock package version is stale");
assert.equal(pkg.build.extends, "./electron-builder-preview.cjs", "Default build must use the canonical preview configuration");
assert.equal(config.appId, "br.com.mop.preview94.homologacao");
assert.equal(config.productName, "MOP Homologacao");
assert.equal(config.nsis.deleteAppDataOnUninstall, false);
assert.equal(config.extraMetadata.version, pkg.version);
assert.equal(config.extraMetadata.main, pkg.main);
const preview = pkg.version.split("-preview.")[1];
const filename = "electron-builder-ui-next" + preview.replaceAll(".", "-") + ".json";
const target = path.join(root, filename);
const expected = JSON.stringify(config, null, 2) + "\n";
if (args.includes("--check")) {
  assert.ok(fs.existsSync(target), "Compatibility configuration is missing; run npm run config:preview");
  assert.equal(fs.readFileSync(target, "utf8"), expected, "Compatibility configuration is stale; run npm run config:preview");
} else if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== expected) {
  fs.writeFileSync(target, expected, "utf8");
}
console.log(JSON.stringify({ status: "passed", version: pkg.version, entry: pkg.main, configuration: filename, output: config.directories.output, mode: args.includes("--check") ? "checked" : "exported" }));
