'use strict';
const {app}=require('electron'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {Store,empty}=require('../desktop/store.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop-operator-shift-')),setPath=app.setPath.bind(app);
app.setPath=(name,value)=>setPath(name,name==='userData'?dir:value);
const cloud=require('./support/cloud.cjs')(),from=cloud.client.from;
cloud.client.from=table=>{const q=from(table);if(table==='mop_members'){const then=q.then;q.then=(resolve,reject)=>then.call(q,r=>resolve({...r,data:r.data.map(x=>({...x,username:'operador',display_name:'Operador Teste',role:'operator',condos:['CEA']}))}),reject);}return q;};
const seed=new Store(path.join(dir,'dados')),s=empty();
if(!process.env.MOP_EMPTY_SHIFT){s.items.push({id:1,protocol:'MOP-20260929-ABCDEF123456',subject:'Crítico autorizado',status:'Pendente',priority:'Urgente',condo:'CEA',category:'Ocorrência',created_at:new Date().toISOString(),updated_at:new Date().toISOString()});s.nextItem=2;}
seed.write(s);seed.close();
const mod=require('../desktop/sync-engine.cjs'),Base=mod.SyncEngine;mod.SyncEngine=class extends Base{constructor(store,options){super(store,{...options,clientFactory:()=>cloud.client});}};
const until=async fn=>{for(let i=0;i<300;i++){if(await fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timeout operador/turno');};
app.on('browser-window-created',(_event,win)=>{const js=code=>win.webContents.executeJavaScript(code);win.webContents.once('did-finish-load',async()=>{try{
 await until(()=>js(`document.querySelector('#startup').dataset.state==='login'`));
 await js(`document.querySelector('#loginEmail').value='operator@example.com';document.querySelector('#loginPassword').value='test-only';document.querySelector('#loginUpload').checked=true;document.querySelector('#loginForm').requestSubmit()`);
 await until(()=>js(`document.querySelector('#startup').hidden`));
 await until(()=>js(`!!document.querySelector('dialog[open]')||!!document.querySelector('#tutorialSkip')||!!document.querySelector('#shiftGateAccept')`));
 await js(`document.querySelector('dialog[open]:not(:has(#shiftGateAccept))')?.close('ok')`);
 await until(()=>js(`!!document.querySelector('#tutorialSkip')||!!document.querySelector('#shiftGateAccept')`));await js(`document.querySelector('#tutorialSkip')?.click()`);
 await until(()=>js(`!!document.querySelector('#shiftGateAccept')`));
 if(!process.env.MOP_EMPTY_SHIFT){await js(`document.querySelector('#shiftGateAccept').click()`);assert.match(await js(`document.querySelector('#shiftGateError').textContent`),/ciência/);assert.equal(await js(`readStore().handovers.length`),0);await js(`document.querySelectorAll('[data-critical]').forEach(x=>x.checked=true)`);}
 await js(`document.querySelector('#shiftGateAccept').click();document.querySelector('#shiftGateAccept')?.click()`);
 await until(()=>js(`!document.querySelector('#shiftGateAccept')`));
 assert.equal(await js(`MOPShiftGate.allowed()`),true);assert.equal(await js(`readStore().handovers.length`),1);
 assert.equal(await js(`readStore().handovers[0].receipt_override`),false);assert.equal(await js(`readStore().handovers[0].delivered_at`),null);
 assert.match(await js(`document.querySelector('#sessionIdentity').textContent`),/Turno atual/);
 assert.equal(await js(`document.querySelector('#saveRecord').disabled`),false);
 await js(`MOPShiftGate.ensure()`);assert.equal(await js(`readStore().handovers.length`),1);
 console.log('OPERATOR_SHIFT_UI_OK '+(process.env.MOP_EMPTY_SHIFT?'empty':'critical'));win.close();
 }catch(e){console.error(e);app.exit(1);}});});
require('../desktop/main.cjs');setTimeout(()=>app.exit(1),30000).unref();
