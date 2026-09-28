'use strict';
const {app,BrowserWindow,powerMonitor}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {Store,empty}=require('../desktop/store.cjs');
const cloud=require('./support/cloud.cjs')();
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop-auth-ui-'));
const setPath=app.setPath.bind(app);app.setPath=(name,value)=>setPath(name,name==='userData'?dir:value);
const secret='REGISTRO CONFIDENCIAL DE TESTE';
const seed=new Store(path.join(dir,'dados')),state=empty();
state.items.push({id:1,protocol:'MOP-20260927-ABCDEF123456',subject:secret,status:'Pendente',priority:'Normal',condo:'CEA',category:'Ocorrência',company:'',reference:'',description:'Conteúdo reservado',created_by:'Teste',updated_by:'Teste',created_at:new Date().toISOString(),updated_at:new Date().toISOString()});state.nextItem=2;seed.write(state);seed.close();
let engine;
const syncModule=require('../desktop/sync-engine.cjs'),Base=syncModule.SyncEngine;
syncModule.SyncEngine=class extends Base{constructor(store,options){super(store,{...options,clientFactory:()=>cloud.client});engine=this;}};
async function until(fn){for(let i=0;i<200;i++){try{if(await fn())return;}catch{}await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Timeout da autenticação');}
app.on('browser-window-created',(_event,win)=>{
  const js=code=>win.webContents.executeJavaScript(code);
  const login=async(password='test-only')=>{await js(`document.querySelector('#loginEmail').value='operator@example.com';document.querySelector('#loginPassword').value=${JSON.stringify(password)};document.querySelector('#loginUpload').checked=true;document.querySelector('#loginForm').requestSubmit();`);};
  const locked=()=>until(()=>js(`document.querySelector('#startup').dataset.state==='login'`));
  const ready=()=>until(()=>js(`document.querySelector('#startup').hidden`));
  const deny=async()=>{
    const results=await js(`(async()=>{const calls=[()=>mopDesktop.read(),()=>mopDesktop.write({}),()=>mopDesktop.exportData(),()=>mopDesktop.openData(),...['status','now','conflicts','resolve','connect'].map(name=>()=>mopDesktop.sync(name,{}))];return Promise.all(calls.map(async call=>{try{await call();return 'ALLOWED';}catch(e){return e.message;}}));})()`);
    for(const message of results)assert.match(message,/Entre com seu e-mail e senha/);
    assert.equal(await js(`document.body.textContent.includes(${JSON.stringify(secret)})`),false);
    assert.equal(await js(`typeof window.initializeMop`),'undefined');
    assert.equal(await js(`document.querySelector('#stats').children.length`),0);
  };
  win.webContents.once('did-finish-load',async()=>{
    try{
      await locked();await deny();fs.writeFileSync(path.join(dir,'login.png'),(await win.webContents.capturePage()).toPNG());
      await login('wrong');await until(()=>js(`!!document.querySelector('#startupError').textContent`));await deny();
      await login();await ready();await engine.kick();assert.equal(await js(`readStore().items[0].subject`),secret);
      await until(()=>js(`!!document.querySelector('#logoutMop')`));await js(`document.querySelector('#logoutMop').click()`);await locked();await deny();
      cloud.offline(true);await login('wrong');await until(()=>js(`!!document.querySelector('#startupError').textContent`));await deny();
      await login();await ready();assert.equal(await js(`mopDesktop.auth('status').then(s=>s.mode)`),'offline');
      powerMonitor.emit('lock-screen');await locked();await deny();
      cloud.offline(false);await login();await ready();powerMonitor.emit('suspend');await locked();await deny();
      await login();await ready();win.webContents.reload();await locked();await deny();
      await login();await ready();cloud.allowed(false);await engine.kick();await locked();await deny();
      cloud.allowed(false);await login();await until(()=>js(`!!document.querySelector('#startupError').textContent`));await deny();
      cloud.offline(true);await login();await until(()=>js(`document.querySelector('#startupError').textContent.includes('login online')`));await deny();
      assert.equal(engine.local.store.read().items[0].subject,secret);
      console.log('AUTH_UI_OK: sem dados antes do login; IPC protegido; senha incorreta; offline; logout; bloqueio; suspensão; reload; revogação. Captura: '+dir);
      win.close();
    }catch(error){console.error(error);try{console.error(await js(`JSON.stringify({state:document.querySelector('#startup')?.dataset.state,error:document.querySelector('#startupError')?.textContent,message:document.querySelector('#startupMessage')?.textContent,login:!!document.querySelector('#loginForm'),url:location.href})`));}catch{}app.exit(1);}
  });
});
require('../desktop/main.cjs');
setTimeout(()=>{console.error('Timeout auth UI');app.exit(1);},30000).unref();
