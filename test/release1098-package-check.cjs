"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const asar = require("@electron/asar");
const yaml = require("js-yaml");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist-ui-next-109-8");
const archive = path.join(output, "win-unpacked/resources/app.asar");
const version = "2.3.0-preview.109.8";
const installerName = "MOP-Preview109.8-Instalador.exe";
const portableName = "MOP-Preview109.8-Portable.exe";
const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
assert.ok(fs.existsSync(archive), "Build 109.8 must complete before package validation");
const entries = asar.listPackage(archive);
const normalizedEntries = entries.map(name => name.replaceAll("\\", "/").replace(/^\/+/, ""));
// extractFile uses the platform's path separators on Windows.
const extract = name => asar.extractFile(archive, path.normalize(name));
const read = name => extract(name).toString("utf8");
const packageJson = JSON.parse(read("package.json"));
assert.equal(packageJson.version, version, "Packaged version mismatch");
assert.equal(packageJson.main, "desktop/main-next43.cjs", "Packaged entry mismatch");
const releaseNotes = JSON.parse(read("desktop/release-notes.json"));
assert.equal(releaseNotes[0].version, version, "Packaged release notes mismatch");
const config = JSON.parse(fs.readFileSync(path.join(root, "electron-builder-ui-next109-8.json"), "utf8"));
assert.equal(config.appId, "br.com.mop.preview94.homologacao");
assert.equal(config.productName, "MOP Homologacao");
assert.equal(config.nsis.deleteAppDataOnUninstall, false);
assert.equal(config.extraMetadata.version, version);
assert.ok(read("desktop/backup1098.cjs").includes("createPassphraseProtector"));
assert.ok(read("desktop/backup1098-ipc.cjs").includes("assertSame"));
const updater = read("desktop/updater92.cjs");
assert.ok(updater.indexOf("updater.channel='preview'") >= 0, "Preview channel missing");
assert.ok(updater.indexOf("updater.allowDowngrade=false") > updater.indexOf("updater.channel='preview'"), "Downgrade guard must follow channel assignment");

const index = read("ui-next/dist/index.html");
const scriptMatch = index.match(/src="\.\/([^"]+\.js)"/);
assert.ok(scriptMatch, "Compiled module script missing from HTML");
const jsPath = "ui-next/dist/" + scriptMatch[1];
const bundle = read(jsPath);
for (const marker of ["109.8", "mop-backup1098", "records1097-table", "Escolher colunas", "columnVisibility", "Panorama operacional", "mop-shadcn-close", "alert-dialog"]) {
  assert.ok(bundle.includes(marker), "UI bundle marker missing: " + marker);
}
const chartChunks = normalizedEntries.filter(name => /^ui-next\/dist\/assets\/ChartCanvas1097-[^/]+\.js$/.test(name));
assert.equal(chartChunks.length, 1, "Expected one separate ChartCanvas1097 chunk");
assert.ok(bundle.includes(path.posix.basename(chartChunks[0])), "Chart chunk is not referenced by main bundle");
assert.match(read(chartChunks[0]), /recharts/, "Chart chunk does not include Recharts");
const shadcnLicense = read("ui-next/dist/licenses/shadcn-ui.txt");
assert.match(shadcnLicense, /MIT License/);
const runtimeLicense = read("ui-next/dist/licenses/third-party-runtime.txt");
for (const dependency of ["@tanstack/react-table", "recharts", "react-is"]) {
  assert.ok(runtimeLicense.includes(dependency), "Runtime license entry missing: " + dependency);
}
const packagedUiFiles = normalizedEntries.filter(name => name.startsWith("ui-next/dist/") && !asar.statFile(archive, path.normalize(name)).files);
for (const name of packagedUiFiles) {
  const diskPath = path.join(root, name);
  assert.ok(fs.existsSync(diskPath), "Packaged UI file not found in current dist: " + name);
  assert.equal(sha256(extract(name)), sha256(fs.readFileSync(diskPath)), "Packaged UI differs from current dist: " + name);
}

const excludedDevelopmentPaths = normalizedEntries.filter(name =>
  /(^|\/)(?:\.storybook|storybook-static|catalog|test-results)(?:\/|$)/i.test(name) ||
  /^tools(?:\/|$)/i.test(name) ||
  /^test(?:\/|$)/i.test(name) ||
  /^ui-next\/(?:src|node_modules)(?:\/|$)/i.test(name) ||
  /(^|\/)node_modules\/(?:@storybook|storybook)(?:\/|$)/i.test(name)
);
assert.deepEqual(excludedDevelopmentPaths, [], "Development/catalog/database tooling leaked into ASAR");
const databaseOrCredentialFilenames = normalizedEntries.filter(name =>
  /(^|\/)\.env(?:\.|$)|\.(?:sqlite3?|mopbackup|db|pfx|p12|pem|key)$|(^|\/)(?:credentials|secrets)\.json$|(^|\/)\.git(?:\/|$)/i.test(name)
);
assert.deepEqual(databaseOrCredentialFilenames, [], "Database or credential filename found in ASAR");
const ownText = normalizedEntries.filter(name => /^(?:desktop|src|assets|ui-next)\//.test(name) && /\.(?:c?js|mjs|json|html|css)$/i.test(name));
const secretFindings = [];
for (const name of ownText) {
  const content = read(name);
  if (/\bsb_secret_[A-Za-z0-9_-]{16,}\b|\bgh[pousr]_[A-Za-z0-9]{24,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) {
    secretFindings.push({file:name,kind:"recognized secret value pattern"});
  }
  for (const token of content.match(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g) || []) {
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
      if (payload.role === "service_role") secretFindings.push({file:name,kind:"service-role JWT"});
    } catch {}
  }
}
assert.deepEqual(secretFindings, [], "Recognized secret value pattern found; values intentionally not printed");

const installer = fs.readFileSync(path.join(output, installerName));
const installerSha512 = crypto.createHash("sha512").update(installer).digest("base64");
const metadataFiles = ["latest.yml"];
if (fs.existsSync(path.join(output, "preview.yml"))) metadataFiles.push("preview.yml");
for (const name of metadataFiles) {
  const metadata = yaml.load(fs.readFileSync(path.join(output, name), "utf8"));
  assert.equal(metadata.version, version, name + " version mismatch");
  assert.equal(metadata.path, installerName, name + " installer path mismatch");
  assert.equal(metadata.sha512, installerSha512, name + " SHA-512 mismatch");
  const file = metadata.files?.find(entry => entry.url === installerName);
  assert.ok(file, name + " installer file entry missing");
  assert.equal(file.size, installer.length, name + " installer size mismatch");
  assert.equal(file.sha512, installerSha512, name + " file SHA-512 mismatch");
}
for (const name of [installerName, portableName]) {
  const bytes = fs.readFileSync(path.join(output, name));
  assert.equal(bytes.toString("ascii", 0, 2), "MZ", name + " is not a PE executable");
  assert.ok(bytes.length > 100000000, name + " is unexpectedly small");
}
assert.ok(fs.statSync(path.join(output, installerName + ".blockmap")).size > 0, "Installer blockmap missing");
const report = {
  status:"passed", version, entry:packageJson.main, archiveEntries:entries.length,
  appEntries:normalizedEntries.filter(name => /^(?:desktop|src|assets|ui-next)\//.test(name)).length,
  uiBundle:path.posix.basename(jsPath), chartChunk:path.posix.basename(chartChunks[0]),
  tanStackTableIncluded:true, operationalPanoramaIncluded:true, separateRechartsChunk:true,
  shadcnLicenseIncluded:true, runtimeLicensesIncluded:true, packagedUiMatchesDist:true,
  excludedDevelopmentPaths:0, databaseOrCredentialFilenames:0, recognizedSecretValuePatterns:0,
  updaterInstallerNameSizeSHA512Match:true, metadataFiles,
  previewMetadataPresent:metadataFiles.includes("preview.yml"),
  asarSHA256:sha256(fs.readFileSync(archive)),
};
const reportDir = path.join(root, "test-results/release1098");
fs.mkdirSync(reportDir, {recursive:true});
fs.writeFileSync(path.join(reportDir, "package-report.json"), JSON.stringify(report,null,2) + "\n");
console.log(JSON.stringify(report));
