'use strict';
const {app,BrowserWindow,dialog}=require('electron');const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop-management-ui-'));
const setPath=app.setPath.bind(app);app.setPath=(name,value)=>setPath(name,name==='userData'?dir:value);
const cloud=require('./support/cloud.cjs')();const from=cloud.client.from;cloud.client.from=table=>{const q=from(table);if(table==='mop_members'){const then=q.then;q.then=(resolve,reject)=>then.call(q,result=>resolve({...result,data:result.data.map(x=>({...x,role:'admin',display_name:'Marcelo',condos:null,access_version:1}))}),reject);}return q;};
const rpc=cloud.client.rpc;let savedAccess=null;
cloud.client.rpc=async(name,p)=>{
 if(name==='mop_list_members')return {data:[{user_id:'11111111-1111-4111-8111-111111111111',username:savedAccess?.p_username||'marcelo',display_name:savedAccess?.p_display_name||'Marcelo',role:'admin',condos:null}]};
 if(name==='mop_set_operator_220'){savedAccess=p;return {data:true};}
 return rpc(name,p);
};
let engine;const mod=require('../desktop/sync-engine.cjs'),Base=mod.SyncEngine;mod.SyncEngine=class extends Base{constructor(s,o){super(s,{...o,clientFactory:()=>cloud.client});engine=this;}};
const files=[];dialog.showSaveDialog=async(_win,options)=>{const target=path.join(dir,path.basename(options.defaultPath));files.push(target);return {canceled:false,filePath:target};};
const until=async(fn)=>{for(let i=0;i<240;i++){if(await fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('Timeout da interface');};
let mainWindow;app.on('browser-window-created',(_event,win)=>{if(mainWindow)return;mainWindow=win;win.webContents.on('console-message',(_event,...args)=>console.log('RENDERER',...args));const js=code=>win.webContents.executeJavaScript(code).catch(error=>{console.error('FAILED SCRIPT',code);throw error;});win.webContents.once('did-finish-load',async()=>{try{
 await until(()=>js(`document.querySelector('#startup').dataset.state==='login'`));await js(`document.querySelector('#loginEmail').value='admin@example.com';document.querySelector('#loginPassword').value='test-only';document.querySelector('#loginUpload').checked=true;document.querySelector('#loginForm').requestSubmit()`);await until(()=>js(`document.querySelector('#startup').hidden`));
 await js(`(async()=>{tab('new');const f=document.querySelector('#newForm');for(const [k,v] of Object.entries({condo:'CEA',category:'Ocorrência',subject:'Falha na câmera',description:'Verificar conexão',priority:'Urgente'}))f.elements.namedItem(k).value=v;await saveRecord();if(readStore().items.length!==1)throw Error(document.querySelector('#message').textContent);})()`);
 assert.equal(await js(`readStore().items[0].created_by`),'Marcelo');assert.ok(!(await js(`document.body.innerText`)).includes('admin@example.com'));
 assert.equal(await js(`document.querySelector('#loginEmail').value`),'');
 await js(`tab('permissions')`);await until(()=>js(`!!document.querySelector('[data-edit-member]')`));
 await js(`document.querySelector('[data-edit-member]').click();const accessForm=document.querySelector('#accessForm');accessForm.elements.username.value='marcelo';accessForm.elements.display_name.value='Marcelo Operação';accessForm.requestSubmit()`);
 await until(()=>savedAccess!==null);assert.equal(savedAccess.p_display_name,'Marcelo Operação');assert.equal(savedAccess.p_username,'marcelo');assert.equal(savedAccess.p_user_id,'11111111-1111-4111-8111-111111111111');assert.ok(!JSON.stringify(savedAccess).includes('@'));
 await js(`tab('handover');document.querySelector('#handoverForm [name=outgoing]').value='Turno anterior';document.querySelector('[data-critical]').checked=true;assumeShift()`);assert.equal(await js(`readStore().handovers[0].critical_protocols.length`),1);
 await js(`tab('checklists');const f=document.querySelector('#templateForm');f.elements.title.value='Abertura da central';f.elements.condo.value='CEA';f.elements.steps.value='Câmeras transmitindo\\nAlarmes funcionando';f.requestSubmit()`);await until(()=>js(`readStore().templates.length===1`));
 await js(`const runForm=document.querySelector('#dueList form');runForm.querySelectorAll('select').forEach(s=>s.value='ok');runForm.requestSubmit()`);assert.equal(await js(`readStore().runs.length`),1);
 await js(`tab('indicators')`);assert.ok((await js(`document.querySelector('#metricResults').textContent`)).includes('Tempo médio'));
 await js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);fs.writeFileSync(path.join(dir,'indicators.png'),(await win.webContents.capturePage()).toPNG());
 await js(`tab('reports');mopDesktop.download({type:'xlsx',filters:{}})`);await js(`mopDesktop.download({type:'pdf',filters:{}})`);
 assert.ok(fs.readFileSync(files.find(f=>f.endsWith('.pdf'))).subarray(0,5).toString()==='%PDF-');assert.ok(fs.statSync(files.find(f=>f.endsWith('.xlsx'))).size>1000);
 await js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);fs.writeFileSync(path.join(dir,'reports.png'),(await win.webContents.capturePage()).toPNG());
 await js(`tab('alerts')`);assert.ok((await js(`document.querySelector('#alerts').textContent`)).includes('Falha na câmera'));await js(`tab('portal')`);assert.ok((await js(`document.querySelector('#portal').textContent`)).includes('ainda não liberado'));
 const pdfView=new BrowserWindow({show:false,width:900,height:1100,webPreferences:{sandbox:true}});await pdfView.loadFile(files.find(f=>f.endsWith('.pdf')));await new Promise(r=>setTimeout(r,1200));fs.writeFileSync(path.join(dir,'pdf-preview.png'),(await pdfView.webContents.capturePage()).toPNG());pdfView.destroy();
 await engine.kick();console.log('MANAGEMENT_UI_OK '+dir);win.close();
 }catch(error){console.error(error);console.error(await js(`JSON.stringify({error:document.querySelector('#startupError').textContent,message:document.querySelector('#message')?.textContent})`).catch(()=>''));app.exit(1);}});});
require('../desktop/main.cjs');setTimeout(()=>{console.error('Timeout');app.exit(1);},30000).unref();
