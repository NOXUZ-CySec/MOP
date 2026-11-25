"use strict";
// Canonical preview configuration. Version and entry point come from package.json.
const pkg = require("./package.json");
const match = /^\d+\.\d+\.\d+-preview\.(\d+(?:\.\d+)*)$/.exec(pkg.version);
if (!match) throw new Error("The preview build requires a version such as 2.3.0-preview.109.8 in package.json.");
if (pkg.main !== "desktop/main-next43.cjs") throw new Error("Unexpected preview entry point. Review the release configuration before building.");
const preview = match[1];
module.exports = {
  appId: "br.com.mop.preview94.homologacao",
  productName: "MOP Homologacao",
  directories: { output: "dist-ui-next-" + preview.replaceAll(".", "-") },
  files: ["ui-next/dist/**/*", "desktop/**/*", "src/**/*.js", "assets/**/*", "package.json"],
  asar: true,
  win: {
    icon: "assets/icon.ico",
    target: [{ target: "nsis", arch: ["x64"] }],
    artifactName: "MOP-Preview" + preview + "-Instalador.exe",
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    shortcutName: "MOP Homologacao",
    deleteAppDataOnUninstall: false,
    installerLanguages: ["pt_BR"],
    language: "1046",
  },
  portable: { artifactName: "MOP-Preview" + preview + "-Portable.exe" },
  publish: [{ provider: "github", owner: "NOXUZ-CySec", repo: "MOP", releaseType: "prerelease" }],
  extraMetadata: { main: pkg.main, version: pkg.version },
  compression: "normal",
};
