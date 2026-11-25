"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {chromium,expect}=require(process.env.MOP_PLAYWRIGHT_MODULE||"@playwright/test");
const output=path.resolve(__dirname,"../test-results/release1098"),checks=[],errors=[],external=[];
fs.mkdirSync(output,{recursive:true});
let browser;
async function check(name,fn){await fn();checks.push({name,status:"passed"});console.log("PASS "+name);}
const flush=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const counts=page=>page.evaluate(()=>({reads:window.__readsQA.reads,routines:window.__readsQA.routines,notices:window.__readsQA.notices}));
async function fixture(options={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:"reduce"});
 await context.route("**/*",route=>{
  const u=new URL(route.request().url());
  if(["127.0.0.1","localhost"].includes(u.hostname))return route.continue();
  external.push(u.origin);return route.abort();
 });
 await context.addInitScript(options=>{
  const noop=()=>()=>{},sync=new Set(),locked=new Set();
  const q=window.__readsQA={user:"alpha",role:"operator",accepted:true,reads:0,routines:0,notices:0,mutations:0,
   holdReads:false,holdRoutines:false,holdNotices:false,failRead:false,failRoutine:false,
   pending:{reads:[],routines:[],notices:[],logouts:[]},revision:"initial",...options};
  q.sync=()=>sync.forEach(fn=>fn({dataChanged:true}));
  q.lock=()=>locked.forEach(fn=>fn());
  q.release=(kind,index=0)=>{const item=q.pending[kind][index];if(!item||item.done)throw Error("No held "+kind+" "+index);item.done=true;item.resolve(item.snapshot);};
  const account=()=>({authenticated:true,role:q.role,userId:"qa-"+q.user,username:q.user,display_name:"Operador "+q.user,mode:"offline",condos:["Unidade QA"],demo:!!q.demo});
  const snapshot=()=>({items:[{id:q.user==="alpha"?1:2,protocol:"R-"+q.user.toUpperCase(),subject:"Registro "+q.user,
   description:"Fixture sem dados reais.",category:"Seguran\u00e7a",status:"Pendente",created_at:new Date().toISOString(),
   created_by:"Operador "+q.user,condo:"Unidade QA",created_identity:{user_id:"qa-"+q.user}}]});
  const defer=(kind,value)=>new Promise(resolve=>q.pending[kind].push({resolve,snapshot:value,done:false}));
  window.mopDesktop={
   initialize:async()=>account(),
   onLocked:fn=>{locked.add(fn);return()=>locked.delete(fn);},
   onSync:fn=>{sync.add(fn);return()=>sync.delete(fn);},
   onAlert:noop,onResume:noop,
   read48:async()=>{q.reads++;if(q.failRead)throw Error("Falha simulada de leitura");const value=snapshot();return q.holdReads?defer("reads",value):value;},
   home109:async()=>{
    q.routines++;if(q.failRoutine)throw Error("Falha simulada de rotina");
    const hour=Number(new Intl.DateTimeFormat("en-GB",{hour:"2-digit",hourCycle:"h23",timeZone:"America/Sao_Paulo"}).format(new Date()));
    const period=hour>=6&&hour<18?"day":"night";
    const value={date:new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"America/Sao_Paulo"}).format(new Date()),period,scope:"local",
     tasks:[{id:"task-"+q.user,title:"Rotina "+q.user+" "+q.revision,period,reminder_time:"10:00",done:false}]};
    return q.holdRoutines?defer("routines",value):value;
   },
   notifications:async()=>{q.notices++;const value={history:[{key:q.user,title:"Aviso "+q.user,detail:"Fixture",read:false}]};return q.holdNotices?defer("notices",value):value;},
   handover36:async()=>({stage:"working",items:[]}),
   startup108:async()=>({shiftId:"QA-day",shiftLabel:"Turno QA",deliveryId:null,outgoing:null,deliverySummary:"",
    selfDelivery:false,canBootstrap:true,token:"synthetic",items:[],createdCount:0,criticalCount:0,openCount:0,
    availableRecords:1,centralVerified:true,syncStatus:"connected",accepted:q.accepted,acceptedAt:q.accepted?new Date().toISOString():null}),
   auth:async(action,data)=>{if(action==="login"){q.user=data.login;return account();}return q.holdLogout?defer("logouts",{authenticated:false}):{authenticated:false};},
   recordAction96:async()=>{q.mutations++;throw Error("Writes forbidden in read QA");},
   write32:async()=>{q.mutations++;throw Error("Writes forbidden in read QA");},
  };
  window.mopWindow={command:async()=>({maximized:false}),state:async()=>({maximized:false}),status:async()=>({maximized:false}),onState:noop,onCloseRequest:noop};
 },options);
 const page=await context.newPage();
 page.on("pageerror",error=>errors.push(error.message));
 await page.clock.setFixedTime(new Date("2026-11-25T20:59:55Z"));
 await page.goto(process.env.MOP_READS1098_URL||"http://127.0.0.1:5180/");
 return{context,page,nav:page.getByRole("navigation",{name:"Navega\u00e7\u00e3o principal"})};
}
(async()=>{
 browser=await chromium.launch({headless:true});
 const f=await fixture(),{page,nav}=f;
 await check("Accepted operator loads one initial routines snapshot",async()=>{
  await expect(nav).toBeVisible();await expect(page.getByText("Rotina alpha initial",{exact:true})).toBeVisible();
  await expect.poll(async()=>(await counts(page)).routines).toBe(1);
  await expect(page.getByText("Registro alpha",{exact:true}).first()).toBeVisible();
 });
 await check("One sync event refreshes routines once despite records lastUpdated",async()=>{
  const before=await counts(page);
  await page.evaluate(()=>{window.__readsQA.revision="sync";window.__readsQA.sync();});
  await expect(page.getByText("Rotina alpha sync",{exact:true})).toBeVisible();await flush(page);
  const after=await counts(page);assert.equal(after.routines-before.routines,1);assert.equal(after.reads-before.reads,1);
 });
 await check("Focus burst reuses only the short scoped routines snapshot",async()=>{
  const before=await counts(page);
  await page.evaluate(()=>{for(let i=0;i<8;i++)window.dispatchEvent(new Event("focus"));});await flush(page);
  assert.equal((await counts(page)).routines,before.routines);
 });
 await check("Manual refresh and Alt+R each refresh records and routines",async()=>{
  let before=await counts(page);
  await page.getByRole("button",{name:"Atualizar registros",exact:true}).click();await flush(page);
  let after=await counts(page);assert.equal(after.reads-before.reads,1);assert.equal(after.routines-before.routines,1);
  before=after;await page.keyboard.press("Alt+r");await flush(page);
  after=await counts(page);assert.equal(after.reads-before.reads,1);assert.equal(after.routines-before.routines,1);
 });
 await check("Overlapping sync invalidations queue one fresh routines read",async()=>{
  const before=await counts(page);
  await page.evaluate(()=>{window.__readsQA.holdRoutines=true;window.__readsQA.revision="obsolete";});
  await page.keyboard.press("Alt+r");
  await expect.poll(async()=>(await counts(page)).routines).toBe(before.routines+1);
  await page.evaluate(()=>{const q=window.__readsQA;q.revision="fresh";q.sync();q.sync();q.sync();q.release("routines",0);});
  await expect.poll(async()=>(await counts(page)).routines).toBe(before.routines+2);
  await expect(page.getByText("Rotina alpha obsolete",{exact:true})).toHaveCount(0);
  await page.evaluate(()=>{window.__readsQA.holdRoutines=false;window.__readsQA.release("routines",1);});
  await expect(page.getByText("Rotina alpha fresh",{exact:true})).toBeVisible();await flush(page);
  assert.equal((await counts(page)).routines,before.routines+2);
 });
 await check("Shift and calendar day changes invalidate the routines scope",async()=>{
  let before=await counts(page);
  await page.clock.setFixedTime(new Date("2026-11-25T21:00:00Z"));
  await page.evaluate(()=>{window.__readsQA.revision="night";window.dispatchEvent(new Event("focus"));});
  await expect(page.getByText("Rotina alpha night",{exact:true})).toBeVisible();
  assert.equal((await counts(page)).routines,before.routines+1);
  before=await counts(page);await page.clock.setFixedTime(new Date("2026-11-26T03:00:00Z"));
  await page.evaluate(()=>{window.__readsQA.revision="tomorrow";window.dispatchEvent(new Event("focus"));});
  await expect(page.getByText("Rotina alpha tomorrow",{exact:true})).toBeVisible();
  assert.equal((await counts(page)).routines,before.routines+1);
 });
 await check("Explicit read failure preserves valid rows and retry recovers",async()=>{
  await nav.getByRole("button",{name:"Registros",exact:true}).click();
  await expect(page.locator("[data-record-row]")).toHaveCount(1);
  await page.evaluate(()=>{window.__readsQA.failRead=true;});
  await page.locator(".integration-records-banner").getByRole("button",{name:"Atualizar"}).click();
  await expect(page.locator(".records1097").getByRole("alert")).toContainText("Falha simulada de leitura");
  await expect(page.getByRole("button",{name:/Abrir registro R-ALPHA:/})).toBeVisible();
  await page.evaluate(()=>{window.__readsQA.failRead=false;});
  await page.getByRole("button",{name:"Tentar novamente",exact:true}).click();
  await expect(page.locator(".records1097").getByRole("alert")).toHaveCount(0);
  await nav.getByRole("button",{name:"In\u00edcio",exact:true}).click();
  await expect(page.getByText("Rotina alpha tomorrow",{exact:true})).toBeVisible();
 });
 await check("Late records, routines and notices cannot cross logout and new login",async()=>{
  await page.evaluate(()=>{const q=window.__readsQA;q.holdReads=true;q.holdRoutines=true;q.holdNotices=true;q.revision="old-session";q.sync();});
  await expect.poll(()=>page.evaluate(()=>window.__readsQA.pending.reads.length)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.__readsQA.pending.routines.length)).toBe(3);
  await expect.poll(()=>page.evaluate(()=>window.__readsQA.pending.notices.length)).toBe(1);
  await page.locator(".ref-user").click();
  await page.getByRole("button",{name:"Encerrar sess\u00e3o",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Bem-vindo ao MOP"})).toBeVisible();
  await page.evaluate(()=>{const q=window.__readsQA;q.holdReads=false;q.holdRoutines=false;q.holdNotices=false;q.revision="new-session";});
  await page.getByLabel("Usu\u00e1rio ou e-mail",{exact:true}).fill("beta");
  await page.getByLabel("Senha",{exact:true}).fill("fixture-only");
  await page.getByRole("button",{name:"Entrar no MOP",exact:true}).click();
  await expect(page.getByText("Rotina beta new-session",{exact:true})).toBeVisible();
  await page.evaluate(()=>{const q=window.__readsQA;q.release("reads",0);q.release("routines",2);q.release("notices",0);});await flush(page);
  await expect(page.getByText("Rotina alpha old-session",{exact:true})).toHaveCount(0);
  await expect(page.getByText("Rotina beta new-session",{exact:true})).toBeVisible();
  await page.evaluate(()=>{window.__readsQA.holdNotices=true;});
  await page.locator(".mop-notification-trigger").click();
  await expect(page.getByText("Aviso beta",{exact:true})).toBeVisible();
  await expect(page.getByText("Aviso alpha",{exact:true})).toHaveCount(0);
  await page.keyboard.press("Escape");
  await nav.getByRole("button",{name:"Registros",exact:true}).click();
  await expect(page.getByRole("button",{name:/Abrir registro R-BETA:/})).toBeVisible();
  await expect(page.getByRole("button",{name:/Abrir registro R-ALPHA:/})).toHaveCount(0);
  await page.screenshot({path:path.join(output,"reads-session-isolation.png"),fullPage:true});
 });

 await check("Forced lock returns a real session to login and rejects pending snapshots",async()=>{
  const locked=await fixture(),p=locked.page;
  await expect(p.getByText("Rotina alpha initial",{exact:true})).toBeVisible();
  await p.evaluate(()=>{const q=window.__readsQA;q.holdReads=true;q.holdRoutines=true;q.holdNotices=true;q.revision="locked";q.sync();});
  await expect.poll(()=>p.evaluate(()=>window.__readsQA.pending.reads.length)).toBe(1);
  await expect.poll(()=>p.evaluate(()=>window.__readsQA.pending.routines.length)).toBe(1);
  await expect.poll(()=>p.evaluate(()=>window.__readsQA.pending.notices.length)).toBe(1);
  await p.evaluate(()=>window.__readsQA.lock());
  await expect(p.getByRole("heading",{name:"Bem-vindo ao MOP"})).toBeVisible();
  await expect(p.getByRole("dialog",{name:"Confer\u00eancia do turno antes de entrar"})).toHaveCount(0);
  await p.evaluate(()=>{const q=window.__readsQA;q.holdReads=false;q.holdRoutines=false;q.holdNotices=false;q.revision="unlocked";});
  await p.getByLabel("Usu\u00e1rio ou e-mail",{exact:true}).fill("beta");await p.getByLabel("Senha",{exact:true}).fill("fixture-only");
  await p.getByRole("button",{name:"Entrar no MOP",exact:true}).click();
  await expect(p.getByText("Rotina beta unlocked",{exact:true})).toBeVisible();
  await p.evaluate(()=>{const q=window.__readsQA;q.release("reads");q.release("routines");q.release("notices");q.holdNotices=true;});await flush(p);
  await expect(p.getByText("Rotina alpha locked",{exact:true})).toHaveCount(0);
  await p.locator(".mop-notification-trigger").click();
  await expect(p.getByText("Aviso beta",{exact:true})).toBeVisible();await expect(p.getByText("Aviso alpha",{exact:true})).toHaveCount(0);
  await p.keyboard.press("Escape");await locked.nav.getByRole("button",{name:"Registros",exact:true}).click();
  await expect(p.getByRole("button",{name:/Abrir registro R-BETA:/})).toBeVisible();
  await expect(p.getByRole("button",{name:/Abrir registro R-ALPHA:/})).toHaveCount(0);
  await locked.context.close();
 });
 await check("Late logout completion cannot end a newer authenticated session",async()=>{
  const held=await fixture(),p=held.page;await expect(held.nav).toBeVisible();
  await p.evaluate(()=>{window.__readsQA.holdLogout=true;});
  await p.locator(".ref-user").click();await p.getByRole("button",{name:"Encerrar sess\u00e3o",exact:true}).click();
  await expect.poll(()=>p.evaluate(()=>window.__readsQA.pending.logouts.length)).toBe(1);
  await p.evaluate(()=>window.__readsQA.lock());
  await expect(p.getByRole("heading",{name:"Bem-vindo ao MOP"})).toBeVisible();
  await p.getByLabel("Usu\u00e1rio ou e-mail",{exact:true}).fill("beta");await p.getByLabel("Senha",{exact:true}).fill("fixture-only");
  await p.getByRole("button",{name:"Entrar no MOP",exact:true}).click();await expect(held.nav).toBeVisible();
  await p.evaluate(()=>window.__readsQA.release("logouts"));await flush(p);
  await expect(held.nav).toBeVisible();await expect(p.locator(".ref-user")).toContainText("Operador beta");
  await expect(p.getByRole("heading",{name:"Bem-vindo ao MOP"})).toHaveCount(0);
  await held.context.close();
 });
 await check("Viewer and unaccepted operator do not query routines",async()=>{
  const viewer=await fixture({role:"viewer"});
  await expect(viewer.nav).toBeVisible();await flush(viewer.page);
  assert.equal((await counts(viewer.page)).routines,0);
  await expect(viewer.page.getByText("Indicadores de rotinas indispon\u00edveis para este perfil.",{exact:true})).toHaveCount(2);
  assert.equal(await viewer.page.evaluate(()=>window.__readsQA.mutations),0);await viewer.context.close();
  const blocked=await fixture({accepted:false});
  await expect(blocked.page.getByRole("dialog",{name:"Confer\u00eancia do turno antes de entrar"})).toBeVisible();await flush(blocked.page);
  assert.equal((await counts(blocked.page)).routines,0);
  await expect(blocked.nav).toHaveCount(0);
  assert.equal(await blocked.page.evaluate(()=>window.__readsQA.mutations),0);await blocked.context.close();
 });
 await check("Demo survives backend lock and uses fixtures without operational reads",async()=>{
  const demo=await fixture({demo:true});
  await expect(demo.page.getByRole("dialog",{name:"Confer\u00eancia do turno antes de entrar"})).toBeVisible();
  const boxes=demo.page.getByRole("checkbox");
  for(let i=0;i<await boxes.count();i++)await boxes.nth(i).check();
  await demo.page.locator(".mop108-dialog").getByRole("button",{name:/Confirmar|Receber/i}).last().click();
  await expect(demo.nav).toBeVisible();await flush(demo.page);
  await demo.page.evaluate(()=>window.__readsQA.lock());await flush(demo.page);
  await expect(demo.nav).toBeVisible();
  const c=await counts(demo.page);assert.equal(c.reads,0);assert.equal(c.routines,0);
  await expect(demo.page.getByText("Rotinas n\u00e3o s\u00e3o carregadas neste ambiente de demonstra\u00e7\u00e3o.",{exact:true})).toBeVisible();
  assert.equal(await demo.page.evaluate(()=>window.__readsQA.mutations),0);await demo.context.close();
 });
 await check("No JavaScript errors, external requests or data writes",async()=>{
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  assert.equal(await page.evaluate(()=>window.__readsQA.mutations),0);
 });
 const report={status:"passed",checks:checks.length,details:checks,bridge:"synthetic read-only snapshots; no live database",externalRequests:external.length};
 fs.writeFileSync(path.join(output,"reads-ui-report.json"),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 await f.context.close();
})().catch(error=>{
 fs.writeFileSync(path.join(output,"reads-ui-report.json"),JSON.stringify({status:"failed",checks:checks.length,details:checks,error:error.stack,errors,external},null,2));
 console.error(error);process.exitCode=1;
}).finally(async()=>{await browser?.close();});
