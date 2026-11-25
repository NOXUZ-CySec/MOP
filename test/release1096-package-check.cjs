"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const r=path.resolve(__dirname,"..");
const asar=require("@electron/asar");
const out=path.join(r,"dist-ui-next-109-6"),archive=path.join(out,"win-unpacked/resources/app.asar");
const entries=asar.listPackage(archive);
const read=p=>asar.extractFile(archive,path.normalize(p)).toString("utf8");
const pkg=JSON.parse(read("package.json"));
assert.equal(pkg.version,"2.3.0-preview.109.6");assert.equal(pkg.main,"desktop/main-next43.cjs");
assert.match(read("ui-next/dist/licenses/shadcn-ui.txt"),/MIT License/);
const updater=read("desktop/updater92.cjs");
assert.ok(updater.indexOf("updater.allowDowngrade=false")>updater.indexOf("updater.channel='preview'"));
const note=JSON.parse(read("desktop/release-notes.json"))[0];assert.equal(note.version,pkg.version);
const index=read("ui-next/dist/index.html");
const jsPath="ui-next/dist/"+index.match(/src="\.\/([^"]+\.js)"/)[1];
const bundle=read(jsPath);
assert.match(bundle,/109\.6/);assert.match(bundle,/mop-shadcn-close/);assert.match(bundle,/alert-dialog/);
const yml=fs.readFileSync(path.join(out,"latest.yml"),"utf8");
const installer=fs.readFileSync(path.join(out,"MOP-Preview109.6-Instalador.exe"));
const sha512=crypto.createHash("sha512").update(installer).digest("base64");
assert.ok(yml.includes("version: "+pkg.version));assert.ok(yml.includes("MOP-Preview109.6-Instalador.exe"));
assert.ok(yml.includes(sha512));assert.ok(yml.includes("size: "+installer.length));
for(const name of ["MOP-Preview109.6-Instalador.exe","MOP-Preview109.6-Portable.exe"]){
 const b=fs.readFileSync(path.join(out,name));assert.equal(b.toString("ascii",0,2),"MZ");assert.ok(b.length>100000000);
}
assert.ok(fs.statSync(path.join(out,"MOP-Preview109.6-Instalador.exe.blockmap")).size>0);
const candidate=entries.filter(p=>/(\.env(?:\.|$)|\.(?:sqlite3?|db|pfx|pem|key)$|credentials\.json$|(^|[\\/])\.git([\\/]|$))/i.test(p));
assert.deepEqual(candidate,[]);
const own=entries.filter(p=>/^[/\\](desktop|src|assets|ui-next)[/\\]/.test(p));
const report={status:"passed",version:pkg.version,entry:pkg.main,shadcnLicenseIncluded:true,uiBundle:path.basename(jsPath),
 archiveEntries:entries.length,appEntries:own.length,updaterInstallerNameSizeSHA512Match:true,
 databaseOrCredentialFilenames:0,
 asarSHA256:crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex")};
fs.mkdirSync(path.join(r,"test-results/release1096"),{recursive:true});
fs.writeFileSync(path.join(r,"test-results/release1096/package-report.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report));
