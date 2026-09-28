'use strict';
// Run with Electron. Always redirects the production data path to a temporary profile.
const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const assert=require('node:assert/strict');
const {Store,empty}=require('../desktop/store.cjs');
const {SyncStore}=require('../desktop/sync-store.cjs');
const cloud=require('./support/cloud.cjs')();
const syncModule=require('../desktop/sync-engine.cjs'),Base=syncModule.SyncEngine;
syncModule.SyncEngine=class extends Base{constructor(store,options){super(store,{...options,clientFactory:()=>cloud.client});}};
const dataFailure=process.argv.includes('--data-failure');
const failure=process.argv.includes('--failure')||dataFailure;
const reduced=process.argv.includes('--reduced');
if(reduced)app.commandLine.appendSwitch('force-prefers-reduced-motion','reduce');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop-startup-'));
const dataDir=path.join(dir,'dados');
const fixture={...empty(),handovers:[{id:1,at:new Date().toISOString(),incoming:'Teste B',outgoing:'Teste A',note:'Preservar',open_ids:'[]',snapshot:[]}],nextHandover:2};
let seed=new Store(dataDir);seed.write(fixture);
new SyncStore(seed).bind(require('../desktop/supabase-config.cjs').url+'|00000000-0000-4000-8000-000000000001');
const backups=fs.readdirSync(seed.backupDir).map(name=>[name,fs.readFileSync(path.join(seed.backupDir,name),'utf8')]);
const brokenPayload=dataFailure?JSON.stringify({...fixture,handovers:[{...fixture.handovers[0],open_ids:'invalid'}]}):'{invalid';
if(failure)seed.db.prepare('UPDATE state SET payload=? WHERE id=1').run(brokenPayload);
seed.close();
const originalSetPath=app.setPath.bind(app);
app.setPath=(name,value)=>originalSetPath(name,name==='userData'?dir:value);
const handle=ipcMain.handle.bind(ipcMain);
let attempts=0;
let visiblePaint=false;
// Observe frames only after the production visibility handshake completes.
ipcMain.handle=(channel,listener)=>handle(channel,channel==='mop:initialize'?async(event,...args)=>{
  const win=BrowserWindow.fromWebContents(event.sender);
  assert.equal(win.isVisible(),true,'Banco deve iniciar com a janela visível');
  assert.equal(visiblePaint,true,'Tela deve pintar após a janela ficar visível');
  if(!reduced){
    if(!event.sender.debugger.isAttached())event.sender.debugger.attach('1.3');
    await event.sender.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  }
  const before=await event.sender.executeJavaScript(`({state:document.querySelector('#startup').dataset.state,inert:document.querySelector('#appContent').inert,logo:document.querySelector('#startupLogo').naturalWidth,reads:typeof window.initializeMop,animation:getComputedStyle(document.querySelector('.startup-track'),'::after').animationName,percent:document.querySelector('[role="progressbar"]').hasAttribute('aria-valuenow')})`);
  assert.equal(before.state,'loading');assert.equal(before.inert,true);assert.ok(before.logo>0);assert.equal(before.percent,false);
  if(attempts===0)assert.equal(before.reads,'undefined');
  const prefersReduced=await event.sender.executeJavaScript(`matchMedia('(prefers-reduced-motion: reduce)').matches`);
  if(reduced)assert.equal(prefersReduced,true);
  assert.equal(before.animation,prefersReduced?'none':'startup-progress');
  attempts++;
  await new Promise(resolve=>win.isVisible()?resolve():win.once('show',resolve));
  fs.writeFileSync(path.join(dir,'loading.png'),(await win.webContents.capturePage()).toPNG());
  return listener(event,...args);
}:channel==='mop:shown'?async(event,...args)=>{
  const result=await listener(event,...args);
  await event.sender.executeJavaScript(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  visiblePaint=true;
  return result;
}:listener);
const until=async(fn)=>{for(let i=0;i<200;i++){if(await fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('Timeout aguardando estado da interface');};
app.on('browser-window-created',(_event,win)=>{
  win.webContents.once('did-finish-load',async()=>{
    const js=code=>win.webContents.executeJavaScript(code);
    const login=async()=>{
      await until(()=>js(`document.querySelector('#startup').dataset.state==='login'`));
      await js(`document.querySelector('#loginEmail').value='operator@example.com';document.querySelector('#loginPassword').value='test-only';document.querySelector('#loginUpload').checked=true;document.querySelector('#loginForm').requestSubmit();`);
    };
    try{
      if(!failure||dataFailure)await login();
      if(failure){
        await until(()=>js(`document.querySelector('#startup').dataset.state==='error'`));
        assert.equal(await js(`document.querySelector('#appContent').inert`),true);
        assert.equal(await js(`getComputedStyle(document.querySelector('.startup-track'),'::after').animationName`),'none');
        assert.match(await js(`document.querySelector('#startupMessage').textContent`),/Não foi possível/);
        for(const [name,contents] of backups)assert.equal(fs.readFileSync(path.join(dataDir,'backups',name),'utf8'),contents);
        fs.writeFileSync(path.join(dir,'error.png'),(await win.webContents.capturePage()).toPNG());
        const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(path.join(dataDir,'mop.sqlite'));
        assert.equal(db.prepare('SELECT payload FROM state WHERE id=1').get().payload,brokenPayload);
        db.prepare('UPDATE state SET payload=? WHERE id=1').run(JSON.stringify(fixture));db.close();
        await js(`document.querySelector('#startupRetry').click()`);
        if(!dataFailure)await login();
      }
      await until(()=>js(`document.querySelector('#startup').hidden`));
      assert.equal(await js(`document.querySelector('#appContent').inert`),false);
      assert.equal(await js(`readStore().handovers[0].note`),'Preservar');
      assert.ok(await js(`document.querySelector('#stats').children.length>0`));
      assert.equal(attempts,failure?2:1);
      fs.writeFileSync(path.join(dir,'ready.png'),(await win.webContents.capturePage()).toPNG());
      console.log('STARTUP_OK '+JSON.stringify({failure,dataFailure,reduced,attempts,screenshots:dir}));
      win.close();
    }catch(error){console.error(error);app.exit(1);}
  });
});
require('../desktop/main.cjs');
setTimeout(()=>{console.error('Startup test timeout');app.exit(1);},20000).unref();
