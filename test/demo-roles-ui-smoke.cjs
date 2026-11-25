'use strict';
const {app}=require('electron'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const testRoot=fs.mkdtempSync(path.join(os.tmpdir(),'mop-demo11-ui-'));
const demoData=path.join(testRoot,'MOP-Preview-Homologacao-11');fs.mkdirSync(demoData);
const originalSetPath=app.setPath.bind(app);
app.setPath=(name,value)=>originalSetPath(name,name==='userData'?demoData:value);
app.on('quit',()=>{try{fs.rmSync(testRoot,{recursive:true,force:true});}catch{}});
const role=process.argv[2]||'admin';
const users={admin:'admin.teste',supervisor:'supervisor.teste',operator:'operador.teste',viewer:'consulta.teste'};
if(!users[role])throw Error('Invalid role');
const until=async fn=>{for(let i=0;i<500;i++){if(await fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('UI timeout: '+role);};
app.on('browser-window-created',(_,win)=>{
 const js=code=>win.webContents.executeJavaScript(code);
 win.webContents.once('did-finish-load',async()=>{
  try{
    await until(()=>js("document.querySelector('#startup')?.dataset.state==='login'"));
    await js(`document.querySelector('#loginEmail').value=${JSON.stringify(users[role])};document.querySelector('#loginPassword').value='MOP-Demo-2026!';document.querySelector('#loginUpload').checked=true;document.querySelector('#loginForm').requestSubmit()`);
    await until(()=>js("document.querySelector('#startup')?.hidden||document.querySelector('#startup')?.dataset.state==='error'"));
    const loginState=await js("({state:document.querySelector('#startup').dataset.state,error:document.querySelector('#startupError').textContent})");
    if(loginState.state==='error')throw Error('Initialization error: '+JSON.stringify(loginState));
    await js("document.querySelector('dialog[open]:not(:has(#shiftGateAccept))')?.close('ok')");
    await new Promise(r=>setTimeout(r,250));
    await js("document.querySelector('dialog[open]:not(:has(#shiftGateAccept))')?.close('ok')");
    if(role!=='viewer'){
      await until(()=>js("!!document.querySelector('#shiftGateAccept')||window.MOPShiftGate?.allowed()"));
      if(await js("!!document.querySelector('#shiftGateAccept')")){
        await js("document.querySelectorAll('[data-critical]').forEach(x=>x.checked=true);document.querySelector('#shiftGateAccept').click()");
        await until(()=>js("!document.querySelector('#shiftGateAccept')"));
      }
    }
    await new Promise(r=>setTimeout(r,240));
    await js("document.querySelector('#tutorialSkip')?.click()");
    const snapshot=await js("(()=>({role:window.mopAccount.role,id:window.mopAccount.userId,view:document.querySelector('[data-tab=permissions]').hidden,indicators:document.querySelector('[data-tab=indicators]').hidden,new:document.querySelector('[data-tab=new]').hidden,banner:!!document.querySelector('#demoWatermark'),records:readStore().items.map(x=>x.subject),appData:document.querySelector('title').textContent}))()");
    assert.equal(snapshot.role,role);assert.ok(snapshot.banner);
    assert.equal(await js("!!document.querySelector('#demoMaintenance')"),role==='admin','Restauração deve aparecer apenas para administradores');assert.ok(snapshot.records.some(x=>x.includes('[DEMONSTRAÇÃO]')),'Missing example records: '+JSON.stringify(snapshot));assert.equal(snapshot.records.length,['admin','supervisor'].includes(role)?14:12,'Condominium isolation: '+JSON.stringify(snapshot));
    assert.equal(snapshot.view,role!=='admin');
    assert.equal(snapshot.indicators,!['admin','supervisor'].includes(role));
    assert.equal(snapshot.new,role==='viewer');
    assert.ok((await js('readStore().handovers.length'))>=3,'Três passagens fictícias disponíveis');
    if(['admin','supervisor'].includes(role)){
      await js("tab('indicators')");
      await until(()=>js("document.querySelectorAll('#indicators .dash-kpi').length>=5"));
      assert.equal(await js("document.querySelector('#indicators .dash-error')?.textContent.trim()"),'');
      assert.ok((await js("document.querySelector('#indicators .dash-kpis').textContent")).includes('Vencidos'));
    }
    if(role!=='viewer'){
      await js("tab('handover')");
      await until(()=>js("document.querySelector('#handoverHistory')?.textContent.includes('Operador')"));
    }
    if(role==='admin'){
      await js("tab('permissions')");
      await until(()=>js("document.querySelector('.access-member-card')?.textContent.includes('Administrador')"));
      assert.equal(await js("document.querySelectorAll('.access-member-card').length"),4);
      assert.equal(await js("document.querySelector('#demoMaintenance')?.open"),false,'Manutenção deve iniciar recolhida');
      assert.equal(await js("typeof window.mopDemo?.reset"),'function');
    }
    console.log('DEMO_ROLE_UI_OK '+JSON.stringify({role,session:snapshot.id,permissionsAvailable:!snapshot.view,indicatorsAvailable:!snapshot.indicators,newAvailable:!snapshot.new}));
    win.close();app.exit(0);
  }catch(e){console.error('DEMO_ROLE_UI_ERROR',role,e);app.exit(1);}
 });
});
require('../desktop/main-demo.cjs');
setTimeout(()=>app.exit(1),30000).unref();
