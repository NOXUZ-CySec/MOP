'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop-sync-ui-'));
const setPath=app.setPath.bind(app);app.setPath=(name,value)=>setPath(name,name==='userData'?dir:value);
const workspace='00000000-0000-4000-8000-000000000001';
let engine,session,offline=false,revision=0,realtime;
const rows=new Map(),receipts=new Map();
const client={
  auth:{getSession:async()=>({data:{session}}),signInWithPassword:async({email})=>{session={user:{id:randomUUID(),email}};return {data:{user:session.user,session}};},stopAutoRefresh:()=>{}},
  channel:()=>{const channel={on:(_type,_filter,callback)=>{realtime=callback;return channel;},subscribe:()=>channel};return channel;},removeChannel:async()=>{},
  from:table=>{
    let cursor=0;const q={select:()=>q,eq:()=>q,gt:(_key,value)=>{cursor=value;return q;},order:()=>q,limit:()=>q,then:(resolve,reject)=>Promise.resolve().then(()=>{if(offline)throw Error('Rede de teste indisponível');return {data:table==='mop_members'?[{workspace_id:workspace}]:[...rows.values()].filter(r=>r.revision>cursor).sort((a,b)=>a.revision-b.revision)};}).then(resolve,reject)};return q;
  },
  rpc:async(_name,p)=>{
    if(offline)throw Error('Rede de teste indisponível');
    if(receipts.has(p.p_op))return {data:receipts.get(p.p_op)};
    const old=rows.get(p.p_id);if(old&&old.version!==p.p_base)return {data:{ok:false,record:old}};
    const record={id:p.p_id,kind:p.p_kind,payload:p.p_payload,version:(old?.version||0)+1,revision:++revision};rows.set(record.id,record);
    const result={ok:true,record};receipts.set(p.p_op,result);return {data:result};
  }
};
const syncModule=require('../desktop/sync-engine.cjs'),Base=syncModule.SyncEngine;
syncModule.SyncEngine=class extends Base{constructor(store,options){super(store,{...options,clientFactory:()=>client});engine=this;}};
const until=async fn=>{for(let i=0;i<200;i++){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Timeout da interface de sincronização');};
app.on('browser-window-created',(_event,win)=>{
  const js=code=>win.webContents.executeJavaScript(code);
  win.webContents.once('did-finish-load',async()=>{
    try{
      await until(()=>js(`document.querySelector('#startup').dataset.state==='login'`));
      await js(`document.querySelector('#loginEmail').value='operador@example.com';document.querySelector('#loginPassword').value='test-only';document.querySelector('#loginUpload').checked=true;document.querySelector('#loginForm').requestSubmit();`);
      await until(()=>engine.status().state==='online');
      await until(()=>js(`!!document.querySelector('#syncOpen')&&document.querySelector('#startup').hidden`));
      assert.equal(await js(`document.querySelector('#loginPassword').value`),'');
      await js(`document.querySelector('#syncOpen').click()`);
      await until(()=>js(`document.querySelector('#syncProject').textContent.includes('https://')`));
      await js(`document.querySelector('#closeSync').click();tab('new');for(const [k,v] of Object.entries({condo:'CEA',category:'Ocorrência',subject:'Teste sincronizado',description:'Preservar',created_by:'Operador'}))document.querySelector('#newForm').elements.namedItem(k).value=v;saveRecord();`);
      await until(()=>rows.size===2&&engine.status().pending===0);
      offline=true;
      await js(`request('/api/items/1/update','POST',{actor:'Operador',note:'Atualização offline',status:'Em andamento',action_taken:'Versão local',next_action:''}).then(()=>refresh())`);
      await engine.kick();assert.equal(engine.status().state,'offline');assert.ok(engine.status().pending>0);
      const remote=[...rows.values()].find(r=>r.kind==='items');rows.set(remote.id,{...remote,version:remote.version+1,revision:++revision,payload:{...remote.payload,action_taken:'Versão da outra máquina'}});
      offline=false;await engine.kick();assert.equal(engine.status().conflicts,1);
      await js(`document.querySelector('#syncOpen').click()`);
      await until(()=>js(`document.querySelectorAll('#syncConflicts table').length===1`));
      assert.match(await js(`document.querySelector('#syncConflicts').textContent`),/Versão da outra máquina/);
      fs.writeFileSync(path.join(dir,'conflict.png'),(await win.webContents.capturePage()).toPNG());
      await js(`Array.from(document.querySelectorAll('#syncConflicts button')).find(b=>b.textContent==='Usar versão da central').click()`);
      await until(()=>engine.status().conflicts===0&&engine.status().pending===0);
      assert.equal(engine.local.store.read().items[0].action_taken,'Versão da outra máquina');
      await js(`document.querySelector('#closeSync').click();tab('records');document.querySelector('.record-card').open=true;document.querySelector('.update-section').open=true;`);
      // Let the existing toggle handler initialize the form, then type a draft.
      await js(`new Promise(r=>requestAnimationFrame(r))`);
      await js(`const note=document.querySelector('form.update [name="note"]');note.value='Não apagar meu rascunho';note.dispatchEvent(new Event('input',{bubbles:true}));`);
      const current=rows.get(remote.id);rows.set(remote.id,{...current,version:current.version+1,revision:++revision,payload:{...current.payload,subject:'Atualizado remotamente'}});realtime();await engine.kick();
      await until(()=>js(`!document.querySelector('#syncUpdate').hidden`));
      assert.equal(await js(`document.querySelector('form.update [name="note"]').value`),'Não apagar meu rascunho');
      assert.match(await js(`request('/api/items/1/update','POST',{actor:'Teste',note:'teste',status:'Pendente'}).then(()=>'',e=>e.message)`),/outra máquina/);
      console.log('SYNC_UI_OK login, gravação offline, conflito, resolução e proteção de rascunho. Captura: '+dir);
      win.close();
    }catch(error){console.error(error);app.exit(1);}
  });
});
require('../desktop/main.cjs');
setTimeout(()=>{console.error('Timeout sync UI');app.exit(1);},25000).unref();
