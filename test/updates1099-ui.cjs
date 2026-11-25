"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {chromium,expect}=require(process.env.MOP_PLAYWRIGHT_MODULE||"@playwright/test");
const root=path.resolve(__dirname,".."),output=path.join(root,"test-results/release1099"),shots=path.join(output,"screenshots");
const installed=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8").replace(/^\uFEFF/,"")).version,target="2.3.0-preview.110";
const checks=[],errors=[],external=[];let browser,lastPage;
fs.mkdirSync(shots,{recursive:true});
const flush=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function check(name,fn){await fn();checks.push({name,status:"passed"});console.log("PASS "+name);}
async function fixture(options={}){
 const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:"reduce"});
 await context.route("**/*",route=>{
  const url=new URL(route.request().url());
  if(["127.0.0.1","localhost"].includes(url.hostname))return route.continue();
  external.push(url.origin);return route.abort();
 });
 await context.addInitScript(({installed,target,options})=>{
  const noop=()=>()=>{},listeners=new Set();
  const current={state:"current",version:installed,percent:0,message:"Voc\u00ea j\u00e1 est\u00e1 usando a vers\u00e3o mais recente."};
  const q=window.__updatesQA={role:"viewer",holdStatus:false,holdCheck:false,failStatus:false,failCheck:false,failInstall:false,failNotes:false,
   noUpdateApi:false,noNotesApi:false,...options,
   calls:{status:0,check:0,install:0,notes:0,backup:0,unexpected:0},state:options.state||current,checkResult:{...current},listeners:0,
   notes:options.notes||[
    {version:installed,date:"2026-11-25",title:"MOP Preview "+installed.split("-preview.")[1]+" \u2014 melhorias de interface",changes:["Painel visual de atualiza\u00e7\u00f5es organizado.","Dados de teste; nenhuma atualiza\u00e7\u00e3o real."]},
    {version:"2.3.0-preview.109.7",date:"2026-11-24",title:"MOP \u2014 auditoria de teste",changes:["Verifica\u00e7\u00e3o isolada do hist\u00f3rico."]},
    {version:"2.3.0-preview.109.6",date:"2026-11-23",title:"MOP \u2014 ajustes anteriores",changes:["Registro sint\u00e9tico de uma vers\u00e3o anterior."]}
   ]};
  q.emit=next=>{q.state={...q.state,...next};for(const fn of listeners)fn({...q.state});};
  q.setState=state=>{q.state={...state};};
  const api={
   initialize:async()=>({authenticated:true,role:q.role,userId:"qa-updater",username:"qa.updater",display_name:"Valida\u00e7\u00e3o de atualiza\u00e7\u00f5es",mode:"offline",condos:q.role==="admin"?null:["Unidade QA"]}),
   onLocked:noop,onSync:noop,onAlert:noop,onResume:noop,
   notifications:async()=>({history:[]}),read48:async()=>({items:[]}),home109:async()=>({date:"2026-11-25",scope:"local",tasks:[]}),
   handover36:async()=>({stage:"working",items:[]}),
   startup108:async()=>({shiftId:"QA",shiftLabel:"Turno QA",deliveryId:null,outgoing:null,deliverySummary:"",selfDelivery:false,canBootstrap:true,token:"synthetic",items:[],createdCount:0,criticalCount:0,accepted:true,acceptedAt:new Date().toISOString()}),
   auth:async()=>({authenticated:false}),
   backup1098:async action=>{q.calls.backup++;if(action!=="status"){q.calls.unexpected++;throw Error("Real backup actions are not allowed in QA");}return{snapshots:[],busy:false,windowsAvailable:true,portableAvailable:true,backupDirectory:"C:\\MOP-QA\\Backups"};},
  };
  if(!q.noUpdateApi){
   api.update=async action=>{
    if(action==="status"){q.calls.status++;if(q.failStatus)throw Error("Falha simulada ao consultar estado.");const snapshot={...q.state};return q.holdStatus?new Promise(resolve=>{q.resolveStatus=()=>resolve(snapshot);}):snapshot;}
    if(action==="check"){q.calls.check++;if(q.failCheck)throw Error("Falha IPC simulada na consulta.");const snapshot={...q.checkResult};return q.holdCheck?new Promise(resolve=>{q.resolveCheck=()=>resolve(snapshot);}):snapshot;}
    if(action==="install"){q.calls.install++;if(q.failInstall)throw Error("Falha IPC simulada na instala\u00e7\u00e3o.");q.emit({state:"installing",version:target,message:"Preparando o rein\u00edcio de teste."});return true;}
    q.calls.unexpected++;throw Error("Unexpected updater action");
   };
   api.onUpdate=callback=>{listeners.add(callback);q.listeners=listeners.size;return()=>{listeners.delete(callback);q.listeners=listeners.size;};};
  }
  if(!q.noNotesApi)api.updateNotes=async()=>{q.calls.notes++;if(q.failNotes)throw Error("Falha simulada nas notas.");return q.notes;};
  window.mopDesktop=api;
  window.mopWindow={command:async()=>({maximized:false}),state:async()=>({maximized:false}),status:async()=>({maximized:false}),onState:noop,onCloseRequest:noop};
 },{installed,target,options});
 const page=lastPage=await context.newPage();
 page.on("pageerror",error=>errors.push(error.message));
 await page.goto(process.env.MOP_UPDATES1099_URL||"http://127.0.0.1:5180/");
 const nav=page.getByRole("navigation",{name:"Navega\u00e7\u00e3o principal"});
 await expect(nav).toBeVisible();await page.getByRole("button",{name:"Configura\u00e7\u00f5es",exact:true}).click();
 const panel=page.getByRole("region",{name:"Atualiza\u00e7\u00f5es do MOP",exact:true});
 await expect(panel).toBeVisible();
 return{context,page,nav,panel,status:panel.getByRole("region",{name:"Estado da atualiza\u00e7\u00e3o",exact:true}),installed:panel.getByRole("region",{name:"Vers\u00e3o instalada",exact:true})};
}
(async()=>{
 browser=await chromium.launch({headless:true});
 const f=await fixture(),{page,panel}=f;
 await check("Installed version remains explicit and initial status does not run a check",async()=>{
  await expect(f.status.getByRole("heading",{name:"Seu MOP est\u00e1 atualizado",exact:true})).toBeVisible();
  await expect(f.installed).toContainText(installed);
  await expect(f.installed).not.toContainText(target);
  assert.deepEqual(await page.evaluate(()=>({status:window.__updatesQA.calls.status,check:window.__updatesQA.calls.check,install:window.__updatesQA.calls.install,listeners:window.__updatesQA.listeners})),{status:1,check:0,install:0,listeners:1});
  await expect(f.status.getByRole("button",{name:"Verificar atualiza\u00e7\u00f5es",exact:true})).toBeEnabled();
  await panel.screenshot({path:path.join(shots,"updates-current-desktop.png")});
 });
 await check("Check deduplicates clicks and newer available event survives a late check response",async()=>{
  await page.evaluate(()=>{window.__updatesQA.holdCheck=true;});
  await f.status.getByRole("button",{name:"Verificar atualiza\u00e7\u00f5es",exact:true}).evaluate(button=>{button.click();button.click();});
  assert.equal(await page.evaluate(()=>window.__updatesQA.calls.check),1);
  await expect(f.status.getByRole("button",{name:"Verificando\u2026",exact:true})).toBeDisabled();
  await page.evaluate(target=>{const q=window.__updatesQA;q.emit({state:"available",version:target,message:"Nova vers\u00e3o encontrada. Download iniciado."});q.resolveCheck();q.holdCheck=false;},target);await flush(page);
  await expect(f.status.getByRole("heading",{name:"Nova vers\u00e3o encontrada",exact:true})).toBeVisible();
  await expect(f.status.getByRole("button",{name:"Preparando download\u2026",exact:true})).toBeDisabled();
  await expect(f.installed).toContainText(installed);await expect(f.installed).not.toContainText(target);
  await expect(f.status.locator(".mop-update1099-target")).toContainText("Preview 110");
 });
 await check("Downloading renders progress and only ready permits a restart",async()=>{
  await page.evaluate(()=>window.__updatesQA.emit({state:"downloading",percent:37,message:"Baixando atualiza\u00e7\u00e3o de teste."}));
  const progress=f.status.getByRole("progressbar",{name:"Progresso do download"});
  await expect(progress).toHaveAttribute("value","37");await expect(f.status).toContainText("37%");
  await expect(f.status.getByRole("button",{name:"Baixando atualiza\u00e7\u00e3o\u2026",exact:true})).toBeDisabled();
  await panel.screenshot({path:path.join(shots,"updates-downloading-desktop.png")});
  await page.evaluate(()=>window.__updatesQA.emit({state:"ready",percent:100,message:"Pacote de teste pronto para instalar."}));
  await expect(progress).toHaveCount(0);await expect(f.status.getByRole("button",{name:"Atualizar e reiniciar",exact:true})).toBeEnabled();
  await expect(f.installed).toContainText(installed);await expect(f.status.locator(".mop-update1099-target")).toContainText("Preview 110");
 });
 await check("Confirmation supports cancellation, Escape, focus trap and trigger focus restoration",async()=>{
  const trigger=f.status.getByRole("button",{name:"Atualizar e reiniciar",exact:true});
  const dialog=page.getByRole("alertdialog",{name:"Atualizar e reiniciar o MOP?",exact:true});
  await trigger.click();await expect(dialog).toBeVisible();await expect(dialog).toContainText("Preview 110");
  assert.equal(await page.evaluate(()=>window.__updatesQA.calls.install),0);
  const cancel=dialog.getByRole("button",{name:"Cancelar",exact:true}),confirm=dialog.getByRole("button",{name:"Confirmar atualiza\u00e7\u00e3o",exact:true});
  await expect(cancel).toBeFocused();await page.keyboard.press("Shift+Tab");await expect(confirm).toBeFocused();await page.keyboard.press("Tab");await expect(cancel).toBeFocused();
  await page.screenshot({path:path.join(shots,"updates-confirm-desktop.png"),fullPage:true});
  await cancel.click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
  await trigger.click();await expect(dialog).toBeVisible();await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();await expect(panel).toBeVisible();
  assert.equal(await page.evaluate(()=>window.__updatesQA.calls.install),0);
 });
 await check("Install invokes once and a later installer error unlocks the interface",async()=>{
  await f.status.getByRole("button",{name:"Atualizar e reiniciar",exact:true}).click();
  await page.getByRole("alertdialog").getByRole("button",{name:"Confirmar atualiza\u00e7\u00e3o",exact:true}).evaluate(button=>{button.click();button.click();});
  assert.equal(await page.evaluate(()=>window.__updatesQA.calls.install),1);
  await expect(f.status.getByRole("button",{name:"Preparando rein\u00edcio\u2026",exact:true})).toBeDisabled();
  await page.evaluate(()=>window.__updatesQA.emit({state:"error",message:"Falha tardia simulada do instalador."}));
  await expect(f.status.getByRole("alert")).toContainText("Falha tardia");
  await expect(f.status.getByRole("button",{name:"Tentar novamente",exact:true})).toBeEnabled();
  await f.status.getByRole("button",{name:"Tentar novamente",exact:true}).click();
  await expect(f.status.getByRole("heading",{name:"Seu MOP est\u00e1 atualizado",exact:true})).toBeVisible();
 });
 await check("IPC failures during check and install remain explicit and retryable",async()=>{
  await page.evaluate(()=>{window.__updatesQA.failCheck=true;});
  await f.status.getByRole("button",{name:"Verificar atualiza\u00e7\u00f5es",exact:true}).click();
  await expect(f.status.getByRole("alert")).toContainText("Falha IPC simulada na consulta");
  await expect(f.status.getByRole("button",{name:"Tentar novamente",exact:true})).toBeEnabled();
  await page.evaluate(target=>{const q=window.__updatesQA;q.failCheck=false;q.failInstall=true;q.emit({state:"ready",version:target,percent:100,message:"Pronta para testar erro IPC."});},target);
  await f.status.getByRole("button",{name:"Atualizar e reiniciar",exact:true}).click();
  await page.getByRole("alertdialog").getByRole("button",{name:"Confirmar atualiza\u00e7\u00e3o",exact:true}).click();
  await expect(f.status.getByRole("alert")).toContainText("Falha IPC simulada na instala\u00e7\u00e3o");
  await expect(f.status.getByRole("button",{name:"Tentar novamente",exact:true})).toBeEnabled();
  await page.evaluate(()=>{window.__updatesQA.failInstall=false;});await f.status.getByRole("button",{name:"Tentar novamente",exact:true}).click();
  await expect(f.status.getByRole("heading",{name:"Seu MOP est\u00e1 atualizado",exact:true})).toBeVisible();
 });
 await check("Dev mode and missing update bridge never offer a working install action",async()=>{
  const dev=await fixture({state:{state:"dev",version:installed,message:"Atualiza\u00e7\u00f5es dispon\u00edveis na vers\u00e3o instalada."}});
  await expect(dev.status.getByRole("button",{name:"Atualiza\u00e7\u00e3o manual",exact:true})).toBeDisabled();
  assert.equal(await dev.page.evaluate(()=>window.__updatesQA.calls.check+window.__updatesQA.calls.install),0);await dev.context.close();
  const absent=await fixture({noUpdateApi:true,noNotesApi:true});
  await expect(absent.status.getByRole("heading",{name:"Atualiza\u00e7\u00e3o indispon\u00edvel",exact:true})).toBeVisible();
  await expect(absent.status.getByRole("button",{name:"Dispon\u00edvel no aplicativo",exact:true})).toBeDisabled();
  assert.equal(await absent.page.evaluate(()=>window.__updatesQA.calls.status+window.__updatesQA.calls.check+window.__updatesQA.calls.install+window.__updatesQA.calls.notes),0);
  await absent.context.close();lastPage=page;
 });
 await check("Late initial status cannot replace an already received ready event",async()=>{
  const late=await fixture({holdStatus:true});
  await expect(late.status.getByRole("button",{name:"Carregando\u2026",exact:true})).toBeDisabled();
  await expect.poll(()=>late.page.evaluate(()=>window.__updatesQA.listeners)).toBe(1);
  await late.page.evaluate(target=>{const q=window.__updatesQA;q.emit({state:"ready",version:target,percent:100,message:"Evento novo de teste."});q.resolveStatus();},target);await flush(late.page);
  await expect(late.status.getByRole("heading",{name:"Pronta para instalar",exact:true})).toBeVisible();
  await expect(late.status.getByRole("button",{name:"Atualizar e reiniciar",exact:true})).toBeEnabled();
  await expect(late.installed).toContainText(installed);await late.context.close();lastPage=page;
 });
 await check("Initial status failure is explicit and a manual check recovers",async()=>{
  const failed=await fixture({failStatus:true});
  await expect(failed.status.getByRole("alert")).toContainText("Falha simulada ao consultar estado");
  await failed.status.getByRole("button",{name:"Tentar novamente",exact:true}).click();
  await expect(failed.status.getByRole("heading",{name:"Seu MOP est\u00e1 atualizado",exact:true})).toBeVisible();
  await failed.context.close();lastPage=page;
 });
 await check("Release history preserves installed marker and keyboard accordion behavior",async()=>{
  const entries=panel.locator(".mop-update1099-release");
  await expect(entries).toHaveCount(3);await expect(entries.first()).toHaveAttribute("open","");
  await expect(entries.first()).toContainText("Instalada");await expect(entries.first()).toContainText("25/11/2026");
  await expect(entries.first().locator("summary")).toContainText("Melhorias de interface");
  assert.equal(await entries.nth(1).evaluate(el=>el.open),false);
  await entries.nth(1).locator("summary").focus();await page.keyboard.press("Enter");await expect(entries.nth(1)).toHaveAttribute("open","");
  await expect(entries.nth(1)).toContainText("Verifica\u00e7\u00e3o isolada do hist\u00f3rico.");
  await page.keyboard.press("Space");assert.equal(await entries.nth(1).evaluate(el=>el.open),false);
 });
 await check("Empty history is explicit and failed notes can be retried independently",async()=>{
  const empty=await fixture({notes:[]});
  await expect(empty.panel.getByText("Nenhuma nota de vers\u00e3o dispon\u00edvel nesta instala\u00e7\u00e3o.",{exact:true})).toBeVisible();
  await expect(empty.panel.locator(".mop-update1099-release")).toHaveCount(0);await empty.context.close();
  const notes=await fixture({failNotes:true});
  await expect(notes.panel.getByText("N\u00e3o foi poss\u00edvel carregar as notas desta instala\u00e7\u00e3o.",{exact:true})).toBeVisible();
  await notes.page.evaluate(()=>{window.__updatesQA.failNotes=false;});
  await notes.panel.getByRole("button",{name:"Recarregar hist\u00f3rico",exact:true}).click();
  await expect(notes.panel.locator(".mop-update1099-release")).toHaveCount(3);
  assert.equal(await notes.page.evaluate(()=>window.__updatesQA.calls.notes),2);
  assert.equal(await notes.page.evaluate(()=>window.__updatesQA.calls.check+window.__updatesQA.calls.install),0);
  await notes.context.close();lastPage=page;
 });
 await check("Update and Backup panels align on desktop and fit compact screens",async()=>{
  const admin=await fixture({role:"admin"}),p=admin.page;
  const backup=p.getByRole("region",{name:"Backup e recupera\u00e7\u00e3o",exact:true});
  await expect(backup).toBeVisible();await expect(admin.status.getByRole("heading",{name:"Seu MOP est\u00e1 atualizado",exact:true})).toBeVisible();
  const match=await p.evaluate(()=>{
   const a=document.querySelector(".mop-update1099"),b=document.querySelector(".mop-backup1098"),sa=getComputedStyle(a),sb=getComputedStyle(b);
   const aa=a.getBoundingClientRect(),bb=b.getBoundingClientRect();
   return {x:Math.abs(aa.x-bb.x),width:Math.abs(aa.width-bb.width),radius:sa.borderRadius===sb.borderRadius,border:sa.borderColor===sb.borderColor,background:sa.backgroundColor===sb.backgroundColor};
  });
  assert.ok(match.x<=1&&match.width<=1);assert.equal(match.radius&&match.border&&match.background,true);
  await p.setViewportSize({width:1440,height:1700});await p.locator(".mop-settings84").scrollIntoViewIfNeeded();
  await p.locator(".mop-settings84").screenshot({path:path.join(shots,"settings-updates-backup-desktop.png")});
  await p.setViewportSize({width:390,height:844});await admin.panel.scrollIntoViewIfNeeded();
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  for(const region of [admin.panel,backup]){const box=await region.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=391);}
  await p.setViewportSize({width:390,height:2900});await p.locator(".mop-settings84").scrollIntoViewIfNeeded();
  await p.locator(".mop-settings84").screenshot({path:path.join(shots,"settings-updates-backup-compact.png")});
  assert.equal(await p.evaluate(()=>window.__updatesQA.calls.backup),1);
  assert.equal(await p.evaluate(()=>window.__updatesQA.calls.unexpected),0);
  await admin.context.close();lastPage=page;
 });
 await check("Leaving Settings removes the listener and drops its pending status snapshot",async()=>{
  const pending=await fixture({holdStatus:true});
  await expect.poll(()=>pending.page.evaluate(()=>window.__updatesQA.listeners)).toBe(1);
  await pending.nav.getByRole("button",{name:"In\u00edcio",exact:true}).click();
  await expect.poll(()=>pending.page.evaluate(()=>window.__updatesQA.listeners)).toBe(0);
  await pending.page.evaluate(()=>{const q=window.__updatesQA;q.resolveStatus();q.emit({state:"ready",version:"2.3.0-preview.110",message:"Late after unmount"});});await flush(pending.page);
  await expect(pending.panel).toHaveCount(0);await pending.context.close();lastPage=page;
 });
 await check("No JavaScript errors, external requests or unexpected backend actions",async()=>{
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(await page.evaluate(()=>window.__updatesQA.calls.unexpected),0);
 });
 const report={status:"passed",checks:checks.length,details:checks,buildVersion:installed,bridge:"synthetic updater and backup bridge; no native updater, download, installer, database or real profile accessed",externalRequests:external.length};
 fs.writeFileSync(path.join(output,"updates-ui-report.json"),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await f.context.close();
})().catch(async error=>{
 if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:path.join(shots,"updates-failure.png"),fullPage:true}).catch(()=>{});
 fs.writeFileSync(path.join(output,"updates-ui-report.json"),JSON.stringify({status:"failed",checks:checks.length,details:checks,error:error.stack,errors,external},null,2));
 console.error(error);process.exitCode=1;
}).finally(async()=>{await browser?.close();});
