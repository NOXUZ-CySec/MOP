"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {chromium,expect}=require(process.env.MOP_PLAYWRIGHT_MODULE||"@playwright/test");
const output=path.resolve(__dirname,"../test-results/release1098"),checks=[],errors=[],external=[];
fs.mkdirSync(output,{recursive:true});
const secret="fixture-passphrase-only";
let browser,lastPage;
async function check(name,fn){await fn();checks.push({name,status:"passed"});console.log("PASS "+name);}
const flush=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function fixture(options={}){
 const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:"reduce"});
 await context.route("**/*",route=>{
  const u=new URL(route.request().url());
  if(["127.0.0.1","localhost"].includes(u.hostname))return route.continue();
  external.push(u.origin);return route.abort();
 });
 await context.addInitScript(options=>{
  const noop=()=>()=>{},locked=new Set();
  const q=window.__backupQA={user:"admin-qa",role:"admin",condos:null,demo:false,backendBusy:false,windowsAvailable:true,
   calls:[],holdCreate:false,holdRestore:false,...options};
  q.snapshots=[{id:"fixture-windows.mopbackup",bytes:4096,modifiedAt:"2026-11-25T01:00:00Z",protection:"windows-user"}];
  q.lock=()=>locked.forEach(fn=>fn());
  const account=()=>({authenticated:true,role:q.role,userId:"qa-"+q.user,username:q.user,display_name:"QA "+q.user,mode:"offline",condos:q.condos,demo:q.demo});
  const snapshot=()=>({snapshots:q.snapshots.map(item=>({...item})),busy:q.backendBusy,windowsAvailable:q.windowsAvailable,portableAvailable:true,backupDirectory:"C:\\MOP-QA\\Backups"});
  const result=id=>({id,verified:true,integrity:"ok",tableCount:8,pendingOperations:2,conflicts:1,sha256:"f".repeat(64)});
  window.mopDesktop={
   initialize:async()=>account(),
   onLocked:fn=>{locked.add(fn);return()=>locked.delete(fn);},onSync:noop,onAlert:noop,onResume:noop,onUpdate:noop,
   read48:async()=>({items:[]}),home109:async()=>({date:"2026-11-25",scope:"local",tasks:[]}),
   notifications:async()=>({history:[]}),handover36:async()=>({stage:"working",items:[]}),
   startup108:async()=>({shiftId:"QA-day",shiftLabel:"Turno QA",deliveryId:null,outgoing:null,deliverySummary:"",
    selfDelivery:false,canBootstrap:true,token:"synthetic",items:[],createdCount:0,criticalCount:0,openCount:0,accepted:true,acceptedAt:new Date().toISOString()}),
   update:async()=>({state:"idle",message:"Vers\u00e3o de teste isolada."}),updateNotes:async()=>[],
   auth:async(action,data)=>{if(action==="login"){q.user=data.login;return account();}q.lock();return{authenticated:false};},
   backup1098:async(action,input={})=>{
    q.calls.push(action);
    if(action==="status")return snapshot();
    if(action==="create"){
     q.lastProtection=input.protection;q.createPasswordProvided=typeof input.password==="string"&&input.password.length>=12;
     const id="fixture-portable.mopbackup";
     const finish=()=>{q.snapshots=[{id,bytes:8192,modifiedAt:"2026-11-25T02:00:00Z",protection:input.protection},...q.snapshots];return result(id);};
     return q.holdCreate?new Promise(resolve=>{q.releaseCreate=()=>resolve(finish());}):finish();
    }
    if(action==="verify"||action==="restore"){
     const item=q.snapshots.find(item=>item.id===input.id);
     if(item?.protection==="passphrase"&&input.password!=="fixture-passphrase-only")throw Error("Senha incorreta ou arquivo corrompido.");
     const value={...result(input.id),...(action==="restore"?{destinationDirectory:"C:\\MOP-QA\\Recovery\\fixture-portable"}:{})};
     return action==="restore"&&q.holdRestore?new Promise(resolve=>{q.releaseRestore=()=>resolve(value);}):value;
    }
    if(action==="open-folder")return{opened:true};
    throw Error("Unexpected fixture action");
   },
  };
  window.mopWindow={command:async()=>({maximized:false}),state:async()=>({maximized:false}),status:async()=>({maximized:false}),onState:noop,onCloseRequest:noop};
 },options);
 const page=lastPage=await context.newPage();page.on("pageerror",error=>errors.push(error.message));
 await page.goto(process.env.MOP_BACKUP1098_URL||"http://127.0.0.1:5180/");
 if(options.demo){
  await expect(page.getByRole("dialog",{name:"Confer\u00eancia do turno antes de entrar"})).toBeVisible();
  const boxes=page.getByRole("checkbox");
  for(let i=0;i<await boxes.count();i++)await boxes.nth(i).check();
  await page.locator(".mop108-dialog").getByRole("button",{name:/Confirmar|Receber/i}).last().click();
 }
 const nav=page.getByRole("navigation",{name:"Navega\u00e7\u00e3o principal"});
 await expect(nav).toBeVisible();
 await page.getByRole("button",{name:"Configura\u00e7\u00f5es",exact:true}).click();
 return{context,page,nav,section:page.getByRole("region",{name:"Backup e recupera\u00e7\u00e3o"})};
}
(async()=>{
 browser=await chromium.launch({headless:true});
 const f=await fixture(),{page,section}=f;
 await check("Only an unrestricted authenticated admin sees and queries backups",async()=>{
  await expect(section).toBeVisible();
  await expect(page.locator("#backup1098-protection")).toContainText("Meu usu\u00e1rio do Windows");
  await expect(page.locator("#backup1098-selected")).toContainText("4.0 KB \u00b7 Windows");
  await expect(section.locator("select")).toHaveCount(0);
  assert.deepEqual(await page.evaluate(()=>window.__backupQA.calls),["status"]);
  for(const options of [{role:"viewer"},{role:"operator"},{role:"supervisor"},{condos:[]},{condos:["Scoped"]},{demo:true}]){
   const denied=await fixture(options);await flush(denied.page);
   await expect(denied.section).toHaveCount(0);
   assert.deepEqual(await denied.page.evaluate(()=>window.__backupQA.calls),[]);
   await denied.context.close();
  }
  lastPage=page;
 });
 await check("Portable backup requires a minimum password and matching confirmation",async()=>{
  const trigger=page.locator("#backup1098-protection");
  await trigger.click();
  const menu=page.getByRole("listbox",{name:"Prote\u00e7\u00e3o do backup",exact:true});
  await expect(menu.getByRole("option",{name:"Meu usu\u00e1rio do Windows",exact:true})).toHaveCount(0);
  await expect(menu.getByRole("option",{name:"Port\u00e1til, com senha",exact:true})).toBeVisible();
  await section.screenshot({path:path.join(output,"backup-protection-dropdown-desktop.png")});
  await page.keyboard.press("Escape");await expect(menu).toHaveCount(0);await expect(trigger).toBeFocused();
  await trigger.press("Enter");await trigger.press("Tab");
  await expect(menu.getByRole("option",{name:"Port\u00e1til, com senha",exact:true})).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(trigger).toContainText("Port\u00e1til, com senha");
  await page.locator("#backup1098-password").fill("short");await page.locator("#backup1098-confirm").fill("short");
  await section.getByRole("button",{name:"Criar backup integral protegido"}).click();
  await expect(section.getByRole("alert")).toContainText("12 caracteres");
  await page.locator("#backup1098-password").fill(secret);await page.locator("#backup1098-confirm").fill("different-long-password");
  await section.getByRole("button",{name:"Criar backup integral protegido"}).click();
  await expect(section.getByRole("alert")).toContainText("confirme a mesma senha");
  assert.equal(await page.evaluate(()=>window.__backupQA.calls.filter(x=>x==="create").length),0);
 });
 await check("Duplicate clicks create once and busy controls prevent other operations",async()=>{
  await page.locator("#backup1098-confirm").fill(secret);await page.evaluate(()=>{window.__backupQA.holdCreate=true;});
  await section.getByRole("button",{name:"Criar backup integral protegido"}).evaluate(button=>{button.click();button.click();});
  await expect.poll(()=>page.evaluate(()=>window.__backupQA.calls.filter(x=>x==="create").length)).toBe(1);
  await expect(section.getByRole("button",{name:"Criar backup integral protegido"})).toBeDisabled();
  await expect(section.getByRole("button",{name:"Verificar backup",exact:true})).toBeDisabled();
  await expect(section.getByRole("button",{name:"Atualizar lista",exact:true})).toBeDisabled();
  await expect(page.locator("#backup1098-protection")).toBeDisabled();await expect(page.locator("#backup1098-selected")).toBeDisabled();
  await page.locator("#backup1098-protection").evaluate(button=>button.click());
  await expect(page.locator("#backup1098-protection")).toHaveAttribute("aria-expanded","false");await expect(section.getByRole("listbox")).toHaveCount(0);
  await page.evaluate(()=>window.__backupQA.releaseCreate());
  await expect(section.getByText("Backup criado e verificado.",{exact:true})).toBeVisible();
  await expect(page.locator("#backup1098-selected")).toContainText("8.0 KB \u00b7 Port\u00e1til");
  const selected=page.locator("#backup1098-selected");await selected.click();
  const choices=page.getByRole("listbox",{name:"Backups dispon\u00edveis",exact:true});
  await expect(choices.getByRole("option")).toHaveCount(1);
  await expect(choices.getByRole("option",{name:/Windows$/})).toBeVisible();
  await expect(choices.getByRole("option",{name:/Port\u00e1til$/})).toHaveCount(0);
  await section.screenshot({path:path.join(output,"backup-snapshots-dropdown-desktop.png")});
  await section.getByRole("heading",{name:"Backup e recupera\u00e7\u00e3o",exact:true}).click();await expect(choices).toHaveCount(0);
  await selected.click();await choices.getByRole("option",{name:/Windows$/}).click();
  await expect(page.locator("#backup1098-unlock")).toHaveCount(0);
  await selected.click();await choices.getByRole("option",{name:/Port\u00e1til$/}).click();
  await expect(page.locator("#backup1098-unlock")).toBeVisible();
  await expect(page.locator("#backup1098-password")).toHaveValue("");await expect(page.locator("#backup1098-confirm")).toHaveValue("");
  assert.equal(await page.evaluate(()=>window.__backupQA.lastProtection),"passphrase");
  assert.equal(await page.evaluate(()=>window.__backupQA.createPasswordProvided),true);
 });
 await check("Wrong backup password shows an error and clears the unlock input",async()=>{
  await page.locator("#backup1098-unlock").fill("incorrect-long-password");
  await section.getByRole("button",{name:"Verificar backup",exact:true}).click();
  await expect(section.getByRole("alert")).toContainText("Senha incorreta");
  await expect(page.locator("#backup1098-unlock")).toHaveValue("");
  await expect(section.getByText("Integridade e prote\u00e7\u00e3o verificadas.",{exact:true})).toHaveCount(0);
 });
 await check("Successful verification presents preserved metadata and clears passwords",async()=>{
  await page.locator("#backup1098-unlock").fill(secret);
  await section.getByRole("button",{name:"Verificar backup",exact:true}).click();
  await expect(section.getByText("Integridade e prote\u00e7\u00e3o verificadas.",{exact:true})).toBeVisible();
  await expect(section).toContainText("8 tabelas verificadas");
  await expect(section).toContainText("2 opera\u00e7\u00f5es pendentes");
  await expect(section).toContainText("1 conflitos preservados");
  await expect(page.locator("#backup1098-unlock")).toHaveValue("");
  await expect(section.getByRole("alert")).toHaveCount(0);
 });
 await check("Recovery result identifies a separate folder and keeps the active database",async()=>{
  await page.locator("#backup1098-unlock").fill(secret);
  await section.getByRole("button",{name:"Testar recupera\u00e7\u00e3o em nova pasta",exact:true}).click();
  await expect(section).toContainText("O banco em uso permanece ativo.");
  await expect(section).toContainText("C:\\MOP-QA\\Recovery\\fixture-portable");
  await expect(page.locator("#backup1098-unlock")).toHaveValue("");
  await section.screenshot({path:path.join(output,"backup-desktop.png")});
  await page.screenshot({path:path.join(output,"backup-settings-desktop.png"),fullPage:true});
 });
 await check("Backup panel fits a compact viewport without horizontal overflow",async()=>{
  await page.setViewportSize({width:390,height:844});
  await section.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  const box=await section.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=391);
  await page.setViewportSize({width:390,height:2000});
  await section.scrollIntoViewIfNeeded();
  await section.screenshot({path:path.join(output,"backup-compact.png")});
  await page.setViewportSize({width:1440,height:1100});
 });
 await check("Backend busy status can be refreshed after the previous job ends",async()=>{
  const busy=await fixture({backendBusy:true});await expect(busy.section).toBeVisible();
  await expect(busy.section.getByRole("button",{name:"Criar backup integral protegido"})).toBeDisabled();
  await expect(busy.section.getByRole("button",{name:"Atualizar lista",exact:true})).toBeEnabled();
  await busy.page.evaluate(()=>{window.__backupQA.backendBusy=false;});
  await busy.section.getByRole("button",{name:"Atualizar lista",exact:true}).click();
  await expect(busy.section.getByRole("button",{name:"Criar backup integral protegido"})).toBeEnabled();
  await busy.context.close();lastPage=page;
 });
 await check("Unavailable Windows protection defaults to a portable copy",async()=>{
  const portable=await fixture({windowsAvailable:false});await expect(portable.section).toBeVisible();
  await expect(portable.page.locator("#backup1098-protection")).toContainText("Port\u00e1til, com senha");
  await portable.page.locator("#backup1098-protection").click();
  await expect(portable.page.getByRole("listbox",{name:"Prote\u00e7\u00e3o do backup",exact:true}).getByRole("option",{name:"Meu usu\u00e1rio do Windows",exact:true})).toHaveCount(0);
  await portable.page.keyboard.press("Escape");
  await expect(portable.page.locator("#backup1098-password")).toBeVisible();
  await portable.context.close();lastPage=page;
 });
 await check("Logout drops passwords and ignores a late recovery result",async()=>{
  await page.locator("#backup1098-password").fill(secret);await page.locator("#backup1098-confirm").fill(secret);
  await page.locator("#backup1098-unlock").fill(secret);await page.evaluate(()=>{window.__backupQA.holdRestore=true;});
  await section.getByRole("button",{name:"Testar recupera\u00e7\u00e3o em nova pasta",exact:true}).click();
  await expect(section.getByRole("button",{name:"Testar recupera\u00e7\u00e3o em nova pasta",exact:true})).toBeDisabled();
  await page.locator(".ref-user").click();await page.getByRole("button",{name:"Encerrar sess\u00e3o",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Bem-vindo ao MOP"})).toBeVisible();
  await page.evaluate(()=>window.__backupQA.releaseRestore());await flush(page);
  await expect(page.locator("#backup1098-password")).toHaveCount(0);
  await page.getByLabel("Usu\u00e1rio ou e-mail",{exact:true}).fill("new-admin");await page.getByLabel("Senha",{exact:true}).fill("fixture-only");
  await page.getByRole("button",{name:"Entrar no MOP",exact:true}).click();
  await expect(f.nav).toBeVisible();await page.getByRole("button",{name:"Configura\u00e7\u00f5es",exact:true}).click();
  await expect(section).toBeVisible();await page.locator("#backup1098-protection").click();
  await page.getByRole("option",{name:"Port\u00e1til, com senha",exact:true}).click();
  await expect(page.locator("#backup1098-password")).toHaveValue("");await expect(page.locator("#backup1098-confirm")).toHaveValue("");
  await expect(page.locator("#backup1098-unlock")).toHaveValue("");
  await expect(section).not.toContainText("C:\\MOP-QA\\Recovery\\fixture-portable");
  assert.equal(await page.evaluate(secret=>JSON.stringify(localStorage).includes(secret)||JSON.stringify(sessionStorage).includes(secret),secret),false);
 });
 await check("No JavaScript errors or external network requests",async()=>{assert.deepEqual(errors,[]);assert.deepEqual(external,[]);});
 const report={status:"passed",checks:checks.length,details:checks,bridge:"synthetic backup metadata and snapshots; no database, encryption or filesystem operations performed",externalRequests:external.length};
 fs.writeFileSync(path.join(output,"backup-ui-report.json"),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await f.context.close();
})().catch(async error=>{
 if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:path.join(output,"backup-failure.png"),fullPage:true}).catch(()=>{});
 fs.writeFileSync(path.join(output,"backup-ui-report.json"),JSON.stringify({status:"failed",checks:checks.length,details:checks,error:error.stack,errors,external},null,2));
 console.error(error);process.exitCode=1;
}).finally(async()=>{await browser?.close();});
