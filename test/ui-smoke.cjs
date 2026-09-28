const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../desktop/store.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop-ui-'));
app.setPath('userData',path.join(dir,'profile'));
app.whenReady().then(async()=>{
 const store=new Store(path.join(dir,'dados'));
 ipcMain.handle('mop:initialize',()=>({ok:true,value:{authenticated:true}}));
 ipcMain.handle('mop:shown',()=>({ok:true,value:true}));
 ipcMain.handle('mop:sync-status',()=>({ok:true,value:{state:'local',message:'Teste local',bound:false,pending:0,conflicts:0,url:'',key:''}}));
 ipcMain.on('mop:read',e=>{e.returnValue={ok:true,value:store.read()};});
 ipcMain.on('mop:write',(e,s)=>{try{store.write(s);e.returnValue={ok:true,value:true};}catch(error){e.returnValue={ok:false,error:error.message};}});
 const win=new BrowserWindow({show:false,webPreferences:{offscreen:true,preload:path.join(__dirname,'../desktop/preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 try{
  await win.loadFile(path.join(__dirname,'../src/index.html'));
  await win.webContents.executeJavaScript(`new Promise(resolve=>{const check=()=>document.querySelector('#startup').hidden?resolve():requestAnimationFrame(check);check();})`);
  const result=await win.webContents.executeJavaScript(`(async()=>{
   const errors=[]; window.addEventListener('error',e=>errors.push(e.message));
   document.querySelector('[data-tab="new"]').click();
   const f=document.querySelector('#newForm');
   for(const [k,v] of Object.entries({condo:'CEA',category:'Ocorrência',subject:'Teste da interface',description:'Persistência real',created_by:'Operador teste'}))f.elements.namedItem(k).value=v;
   await saveRecord();
   const rows=await request('/api/items');
   if(rows.length!==1)throw Error('Registro não salvo pela interface');
   if(document.querySelector('#records').classList.contains('hidden'))throw Error('Aba de registros não abriu');
   if(document.querySelectorAll('.record-card').length!==1)throw Error('Cartão não renderizado');
   for(const name of ['handover','calendar','overview','records'])document.querySelector('[data-tab="'+name+'"]').click();
   return {subject:rows[0].subject,storage:document.querySelector('#storageStatus').textContent,errors};
  })()`);
  await win.webContents.executeJavaScript(`(async()=>{
   window.originalDate=Date;window.testNow='2026-09-26T05:59:59-03:00';
   window.Date=class extends originalDate{constructor(...args){super(...(args.length?args:[testNow]));}static now(){return originalDate.parse(testNow);}};
   window.assertShift=(text,remaining,pending)=>{
    if(!document.querySelector('#currentShift').textContent.includes(text))throw Error('Turno incorreto: '+document.querySelector('#currentShift').textContent);
    if(document.querySelector('#shiftRemaining').textContent!=='Restam '+remaining)throw Error('Contagem incorreta');
    if(document.querySelector('#shiftReceipt').textContent!==(pending?'Troca de turno pendente':'Recebimento confirmado'))throw Error('Recebimento incorreto');
   };
   tickShift();assertShift('Noturno · 25/09/2026','00:00:01',true);
   testNow='2026-09-26T06:00:00-03:00';
   await new Promise(r=>setTimeout(r,1100));
   assertShift('Diurno · 26/09/2026','12:00:00',true);
   document.querySelector('[data-tab="handover"]').click();
   const f=document.querySelector('#handoverForm');f.elements.namedItem('incoming').value='B';f.elements.namedItem('outgoing').value='A';
   await assumeShift();assertShift('Diurno · 26/09/2026','12:00:00',false);
   testNow='2026-09-26T17:59:59-03:00';tickShift();assertShift('Diurno · 26/09/2026','00:00:01',false);
   testNow='2026-09-26T18:00:00-03:00';
   clearTimeout(shiftTimer); // Simulate timers being stopped during suspension.
  })()`);
  win.webContents.send('mop:resume');
  await win.webContents.executeJavaScript(`(async()=>{
   await new Promise(r=>setTimeout(r,50));
   assertShift('Noturno · 26/09/2026','12:00:00',true);
   if(readStore().handovers.length!==1)throw Error('Recebimento criado automaticamente');
   const f=document.querySelector('#handoverForm');f.elements.namedItem('incoming').value='C';f.elements.namedItem('outgoing').value='B';
   await assumeShift();assertShift('Noturno · 26/09/2026','12:00:00',false);
   testNow='2026-09-27T00:00:00-03:00';window.dispatchEvent(new Event('focus'));
   assertShift('Noturno · 26/09/2026','06:00:00',false);
   testNow='2026-09-27T06:00:00-03:00';document.dispatchEvent(new Event('visibilitychange'));tickShift();
   assertShift('Diurno · 27/09/2026','12:00:00',true);
   if(readStore().handovers.length!==2)throw Error('Recebimento criado automaticamente');
   window.Date=originalDate;tickShift();
  })()`);
  console.log('UI_SHIFT_OK: 06h, 18h, meia-noite, timer, resume e recebimento manual');
  if(result.errors.length)throw Error(result.errors.join('; '));
  console.log('UI_SMOKE_OK '+JSON.stringify(result));
  win.destroy();store.close();app.exit(0);
 }catch(error){console.error(error);win.destroy();store.close();app.exit(1);}
});
setTimeout(()=>{console.error('UI smoke timeout');app.exit(1)},30000).unref();
