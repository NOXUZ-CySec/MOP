"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { _electron, expect } = require(process.env.MOP_PLAYWRIGHT_MODULE || "@playwright/test");
const root = path.resolve(__dirname, "..");
const archive = path.join(root, "dist-ui-next-109-8/win-unpacked/resources/app.asar");
const output = path.join(root, "test-results/release1098");
fs.mkdirSync(output, { recursive: true });
const qa = fs.mkdtempSync(path.join(output, "isolated-"));
const checks = [];
const pageErrors = [];
let electronApp;
let closed = false;
const harness = [
  '"use strict";',
  'const fs=require("node:fs"),path=require("node:path");',
  'const {app,session,dialog}=require("electron");',
  'global.__releaseQA={blocked:[],fatal:[]};global.__releaseRequireQA=require;',
  'const dirs={appData:"appData",userData:"userData",sessionData:"sessionData",logs:"logs",crashDumps:"crashDumps"};',
  'for(const [key,folder] of Object.entries(dirs)){const p=path.join(__dirname,folder);fs.mkdirSync(p,{recursive:true});app.setPath(key,p);}',
  'process.env.PORTABLE_EXECUTABLE_FILE=path.join(__dirname,"QA-NOT-A-REAL-PORTABLE.exe");',
  'app.commandLine.appendSwitch("disable-background-networking");',
  'const blocked=kind=>{global.__releaseQA.blocked.push(kind);throw Error("External network disabled for release QA: "+kind)};',
  'global.fetch=async()=>blocked("fetch");',
  'for(const protocol of ["http","https"]){const mod=require("node:"+protocol);mod.request=()=>blocked(protocol+".request");mod.get=()=>blocked(protocol+".get");}',
  'dialog.showErrorBox=(title,message)=>{global.__releaseQA.fatal.push({title,message});console.error(title,message);};',
  'app.whenReady().then(()=>{',
  ' const s=session.defaultSession;const wr=s.webRequest;const register=wr.onBeforeRequest.bind(wr);',
  ' wr.onBeforeRequest=()=>register({urls:["http://*/*","https://*/*","ws://*/*","wss://*/*"]},(_details,callback)=>{global.__releaseQA.blocked.push("chromium");callback({cancel:true});});',
  ' wr.onBeforeRequest();s.setSpellCheckerEnabled(false);s.setSpellCheckerEnabled=()=>{};s.setSpellCheckerLanguages=()=>{};',
  '});',
  'require('+JSON.stringify(path.join(archive,"desktop/main-next43.cjs"))+');'
].join("\n");
fs.writeFileSync(path.join(qa, "main.cjs"), harness);
fs.writeFileSync(path.join(qa, "package.json"), JSON.stringify({name:"mop-release-qa",version:"2.3.0-preview.109.8",main:"main.cjs"}));
async function check(name, fn) { await fn(); checks.push({name,status:"passed"}); }
(async()=>{
  assert.ok(fs.existsSync(archive));
  electronApp=await _electron.launch({
    executablePath:path.join(root,"node_modules/electron/dist/electron.exe"),
    args:[qa],
    cwd:root,
    timeout:45000
  });
  const nativeProcess=electronApp.process();
  const nativeExit=new Promise(resolve=>nativeProcess.once("exit",(code,signal)=>resolve({code,signal})));
  electronApp.on("close",()=>{closed=true;});
  const page=await electronApp.firstWindow({timeout:30000});
  page.on("pageerror",e=>pageErrors.push(e.message));
  await expect(page.getByRole("heading",{name:"Bem-vindo ao MOP"})).toBeVisible({timeout:30000});
  const info=await electronApp.evaluate(({app})=>({
    appData:app.getPath("appData"),userData:app.getPath("userData"),
    sessionData:app.getPath("sessionData"),logs:app.getPath("logs"),crashDumps:app.getPath("crashDumps"),version:app.getVersion(),isPackaged:app.isPackaged
  }));
  await check("Native preload and SQLite initialize in isolated profile",async()=>{
    assert.ok(info.appData.startsWith(qa+path.sep));
    assert.ok(info.userData.startsWith(qa+path.sep));
    assert.ok(info.sessionData.startsWith(qa+path.sep));
    assert.ok(info.logs.startsWith(qa+path.sep));
    assert.ok(info.crashDumps.startsWith(qa+path.sep));
    assert.equal(info.version,"2.3.0-preview.109.8");
    const auth=await page.evaluate(()=>window.mopDesktop.initialize());
    assert.equal(auth.authenticated,false);
    assert.ok(fs.existsSync(path.join(info.userData,"dados/mop.sqlite")));
  });
  await check("Packaged UI and real IPC return Preview 109.8 release notes",async()=>{
    assert.ok(page.url().includes("app.asar/ui-next/dist/index.html"));
    const notes=await page.evaluate(()=>window.mopDesktop.updateNotes());
    assert.equal(notes[0].version,"2.3.0-preview.109.8");
    await expect(page.locator("body")).toContainText(/109\.8/);
    await expect(page.getByLabel("Usu\u00e1rio ou e-mail",{exact:true})).toHaveAttribute("data-slot","input");
    await expect(page.getByLabel("Senha",{exact:true})).toHaveAttribute("data-slot","input");
    await expect(page.getByRole("button",{name:"Entrar no MOP"})).toHaveAttribute("data-slot","button");
    await page.screenshot({path:path.join(output,"native-login.png"),animations:"disabled"});
  });
  await check("Unauthenticated backup IPC is denied before file operations",async()=>{
    const denied=await page.evaluate(async()=>{
      const results=[];
      for(const action of ['status','create','verify','restore','open-folder']){
        try{await window.mopDesktop.backup1098(action);results.push(false)}
        catch{results.push(true)}
      }
      return results;
    });
    assert.deepEqual(denied,[true,true,true,true,true]);
    assert.equal(fs.existsSync(path.join(info.userData,'backups-integral')),false);
  });
  await check("Real Windows and portable encryption preserve isolated SQLite contents",async()=>{
    const nativeBackup=await electronApp.evaluate(async({safeStorage},{archive,qa})=>{
      const require=global.__releaseRequireQA;
      const fs=require('node:fs'),path=require('node:path');
      const {Store}=require(path.join(archive,'desktop/store.cjs'));
      const backup=require(path.join(archive,'desktop/backup1098.cjs'));
      const root=path.join(qa,'backup-fixture');
      fs.mkdirSync(root);
      const store=new Store(path.join(root,'dados'));
      store.db.exec('CREATE TABLE native_backup_probe (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)');
      store.db.prepare('INSERT INTO native_backup_probe VALUES (?,?)').run(1,'native-fixture@example.invalid');
      const windows=backup.createSafeStorageProtector(safeStorage);
      let portable;
      try{
        const backupDirectory=path.join(root,'copies');
        const a=await backup.createSnapshot({db:store.db,backupDirectory,appVersion:'2.3.0-preview.109.8',keyProtector:windows});
        const restored=await backup.restoreToNewDirectory({backupDirectory,id:a.id,destinationDirectory:path.join(root,'windows-recovery'),keyProtector:windows});
        const {DatabaseSync}=require('node:sqlite');
        const checkFile=file=>{const db=new DatabaseSync(file,{readOnly:true});try{return db.prepare('SELECT payload FROM native_backup_probe WHERE id=1').get().payload==='native-fixture@example.invalid'}finally{db.close()}};
        const windowsMatches=checkFile(restored.databasePath);
        portable=backup.createPassphraseProtector('Native-fixture-passphrase-1098');
        const b=await backup.createSnapshot({db:store.db,backupDirectory,appVersion:'2.3.0-preview.109.8',keyProtector:portable});
        portable.dispose();
        portable=backup.createPassphraseProtector('Native-fixture-passphrase-1098');
        const recovered=await backup.restoreToNewDirectory({backupDirectory,id:b.id,destinationDirectory:path.join(root,'portable-recovery'),keyProtector:portable});
        const portableMatches=checkFile(recovered.databasePath);
        return {windowsVerified:a.verified,portableVerified:b.verified,windowsMatches,portableMatches,automaticActivation:recovered.automaticActivation,tableCount:b.tableCount};
      }finally{portable?.dispose();windows.dispose?.();store.close()}
    },{archive,qa});
    assert.equal(nativeBackup.windowsVerified,true);
    assert.equal(nativeBackup.portableVerified,true);
    assert.equal(nativeBackup.windowsMatches,true);
    assert.equal(nativeBackup.portableMatches,true);
    assert.equal(nativeBackup.automaticActivation,false);
    assert.ok(nativeBackup.tableCount>=2);
  });
  const close=page.getByRole("button",{name:"Fechar janela",exact:true});
  const dialog=page.getByRole("alertdialog",{name:"Encerrar o MOP?"});
  await check("Native close dialog cancels and restores focus",async()=>{
    await close.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button",{name:"Cancelar"})).toBeFocused();
    await page.screenshot({path:path.join(output,"native-dialog.png"),animations:"disabled"});
    await dialog.getByRole("button",{name:"Cancelar"}).click();
    await expect(dialog).toBeHidden();
    await expect(close).toBeFocused();
    assert.equal(closed,false);
  });
  await check("Escape dismisses native dialog without closing app",async()=>{
    await close.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    assert.equal(closed,false);
  });
  await check("No renderer errors or unexpected network attempts",async()=>{
    assert.deepEqual(pageErrors,[]);
    const guard=await electronApp.evaluate(()=>global.__releaseQA);
    assert.deepEqual(guard.fatal,[]);
    assert.deepEqual(guard.blocked,[]);
  });
  await check("Confirmation closes app through real IPC",async()=>{
    await close.click();
    await expect(dialog).toBeVisible();
    const onClose=electronApp.waitForEvent("close",{timeout:20000});
    await Promise.all([onClose, dialog.getByRole("button",{name:"Confirmar",exact:true}).click().catch(error=>{
      // Native quit may close the transport before Playwright acknowledges the click.
      if(!/Target page, context or browser has been closed/.test(error.message))throw error;
    })]);
    assert.equal(closed,true);
    const exit=await nativeExit;
    assert.equal(exit.code,0);
    assert.equal(exit.signal,null);
  });
  const report={status:"passed",version:"2.3.0-preview.109.8",checks:checks.length,details:checks,
    runtime:"Electron 44.4.5 loading packaged ASAR with real preload, IPC and SQLite",
    isolation:"Fresh QA appData, userData, sessionData, logs and crashDumps; external network disabled; no real login",
    limitation:"Development Electron harness; installer wizard, upgrade of an existing profile and authenticated sync were not executed",
    screenshots:["native-login.png","native-dialog.png"]};
  fs.writeFileSync(path.join(output,"native-report.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report));
})().catch(error=>{
  fs.writeFileSync(path.join(output,"native-report.json"),JSON.stringify({status:"failed",checks:checks.length,details:checks,error:error.stack,pageErrors},null,2));
  console.error(error);process.exitCode=1;
}).finally(async()=>{
  if(electronApp&&!closed)await electronApp.close().catch(()=>{});
});
