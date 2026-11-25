"use strict";
// Startup gate QA uses a synthetic Electron bridge. No real user, database or network.
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const {chromium,expect}=require(process.env.MOP_PLAYWRIGHT_MODULE||"@playwright/test");
const root=path.resolve(__dirname,"..");
const build=path.resolve(process.env.MOP_STARTUP1101_BUILD_DIR||path.join(root,"ui-next/dist"));
const output=path.resolve(process.env.MOP_STARTUP1101_OUTPUT_DIR||path.join(root,"test-results/release1101"));
const shots=path.join(output,"screenshots"),checks=[],screenshots=[],external=[],errors=[],fixtures=[];
const version=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8").replace(/^\uFEFF/,"")).version;
fs.mkdirSync(shots,{recursive:true});
let browser,server,baseURL,lastPage;
const flush=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const hash=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
async function check(name,fn){await fn();checks.push({name,status:"passed"});console.log("PASS "+name)}
async function capture(page,name){await page.screenshot({path:path.join(shots,name),animations:"disabled"});screenshots.push(name)}
async function fixture(options={}){
 const context=await browser.newContext({viewport:options.viewport||{width:1440,height:900},reducedMotion:"reduce"});
 context.setDefaultTimeout(10000);
 await context.route("**/*",route=>{const url=new URL(route.request().url());if(["127.0.0.1","localhost"].includes(url.hostname))return route.continue();external.push(url.origin);return route.abort()});
 await context.addInitScript(options=>{
  const noop=()=>()=>{},sync=new Set();
  const baseItems=[
   {id:"QA-GATE-010",title:"Receber t\u00e9cnico de elevadores",description:"Visita agendada para avaliar ru\u00eddo no elevador social.",condo:"Edif\u00edcio Horizonte",category:"Manuten\u00e7\u00e3o",status:"Pendente",priority:"Normal",occurredAt:"2026-11-25T11:00:00.000Z",version:"2026-11-25T14:00:00.000Z",critical:false,createdDuringOutgoing:false,createdDuringCurrent:true,assignee:"Equipe de apoio",nextAction:"Acompanhar a visita t\u00e9cnica e registrar o diagn\u00f3stico.",actionTaken:"Agendamento confirmado com a empresa.",deadline:"2026-11-25T19:00:00.000Z",overdue:false},
   {id:"QA-GATE-002",title:"Port\u00e3o de servi\u00e7o indispon\u00edvel",description:"Abertura manual mantida e acesso acompanhado pela portaria.",condo:"Unidade Central",category:"Seguran\u00e7a",status:"Pendente",priority:"Urgente",occurredAt:"2026-11-25T06:30:00.000Z",version:"2026-11-25T14:10:00.000Z",critical:true,createdDuringOutgoing:true,createdDuringCurrent:false,assignee:"Equipe t\u00e9cnica",nextAction:"Confirmar retorno do t\u00e9cnico \u00e0s 14h.",actionTaken:"Acesso isolado e t\u00e9cnico acionado.",deadline:"2026-11-25T17:00:00.000Z",overdue:false},
   {id:"QA-GATE-004",title:"Revis\u00e3o de c\u00e2meras conclu\u00edda",description:"C\u00e2meras testadas durante a ronda anterior.",condo:"Edif\u00edcio Horizonte",category:"Seguran\u00e7a",status:"Conclu\u00eddo",priority:"Normal",occurredAt:"2026-11-25T07:00:00.000Z",version:"2026-11-25T08:00:00.000Z",critical:false,createdDuringOutgoing:true},
   {id:"QA-GATE-006",title:"Vazamento na casa de bombas",description:"Registro parcialmente fechado; confirmar inspe\u00e7\u00e3o hidr\u00e1ulica.",condo:"Unidade Central",category:"Manuten\u00e7\u00e3o",status:"Em andamento",priority:"Normal",occurredAt:"2026-11-24T22:00:00.000Z",version:"2026-11-25T14:05:00.000Z",critical:true,createdDuringOutgoing:false,assignee:"",nextAction:"",actionTaken:"\u00c1rea sinalizada.",deadline:"2026-11-25T14:00:00.000Z",overdue:true}
  ];
  const base={shiftId:"2026-11-25/Diurno",shiftLabel:"Diurno \u00b7 25/11/2026",deliveryId:510,outgoing:"Operador anterior",deliverySummary:"Acompanhar o port\u00e3o e confirmar inspe\u00e7\u00e3o hidr\u00e1ulica.",selfDelivery:false,canBootstrap:false,token:"startup-token-v1",items:baseItems,createdCount:2,criticalCount:2,openCount:3,availableRecords:4,centralVerified:true,syncStatus:"connected",accepted:false,acceptedAt:null};
  const q=window.__startupQA={calls:{snapshot:0,receive:0,unexpected:0},inputs:[],windowCommands:[],windowMaximized:false,pendingSnapshots:[],pendingReceipts:[],holdSnapshot:false,holdReceive:false,failSnapshot:false,failReceive:false,receiveAccepted:true,...options};
  q.snapshot=structuredClone({...base,...options.snapshot});
  q.releaseSnapshot=(index=0)=>{const held=q.pendingSnapshots[index];if(!held||held.done)throw Error("No snapshot "+index);held.done=true;held.resolve(held.value)};
  q.releaseReceive=(index=0)=>{const held=q.pendingReceipts[index];if(!held||held.done)throw Error("No receipt "+index);held.done=true;held.resolve(held.value)};
  q.sync=()=>sync.forEach(fn=>fn({dataChanged:true}));
  q.setSnapshot=patch=>Object.assign(q.snapshot,patch);
  const account=()=>({authenticated:true,role:"operator",userId:"qa-startup",username:"alpha",display_name:"Operador alpha",mode:"online",condos:["Unidade Central","Edif\u00edcio Horizonte"]});
  window.mopDesktop={
   initialize:async()=>account(),onLocked:noop,onAlert:noop,onResume:noop,onSync:fn=>{sync.add(fn);return()=>sync.delete(fn)},
   notifications:async()=>({history:[]}),home109:async()=>({date:"2026-11-25",scope:"local",tasks:[]}),read48:async()=>({items:[]}),
   auth:async(action)=>{if(action==="logout")return{authenticated:false};q.calls.unexpected++;throw Error("Unexpected auth "+action)},
   startup108:async(action,input={})=>{
    if(action==="snapshot"){q.calls.snapshot++;if(q.failSnapshot)throw Error("Falha simulada ao consultar a central.");const value=structuredClone(q.snapshot);return q.holdSnapshot?new Promise(resolve=>q.pendingSnapshots.push({resolve,value,done:false})):value}
    if(action==="receive"){q.calls.receive++;q.inputs.push(structuredClone(input));if(q.failReceive)throw Error("Falha simulada ao registrar recebimento.");const value={accepted:q.receiveAccepted,deliveryId:q.snapshot.deliveryId||511,bootstrap:!q.snapshot.deliveryId,acceptedAt:"2026-11-25T15:00:01.000Z",syncState:q.snapshot.centralVerified===false?"offline":"online"};return q.holdReceive?new Promise(resolve=>q.pendingReceipts.push({resolve,value,done:false})):value}
    q.calls.unexpected++;throw Error("Unexpected startup action "+action);
   },
   handover36:async action=>{if(action==="snapshot"){q.calls.handoverRead=(q.calls.handoverRead||0)+1;return{stage:"delivery",items:[]}}q.calls.unexpected++;throw Error("Handover writes forbidden in startup QA")},
   recordAction96:async()=>{q.calls.unexpected++;throw Error("Record writes forbidden in startup QA")},
   write32:async()=>{q.calls.unexpected++;throw Error("Generic writes forbidden in startup QA")}
  };
  window.mopWindow={command:async action=>{q.windowCommands.push(action);if(action==="maximize")q.windowMaximized=!q.windowMaximized;return{maximized:q.windowMaximized}},state:async()=>({maximized:false}),status:async()=>({maximized:false}),onState:noop,onCloseRequest:noop};
 },options);
 const page=lastPage=await context.newPage();page.on("pageerror",error=>errors.push(error.message));
 await page.clock.setFixedTime(new Date("2026-11-25T15:00:00Z"));
 await page.goto(baseURL);
 const gate=page.locator(".mop108-dialog");
 await expect(gate).toBeVisible();
 const f={context,page,gate};fixtures.push(f);return f;
}
async function startServer(){
 assert.ok(fs.existsSync(path.join(build,"index.html")),"Built UI is required");
 server=http.createServer((req,res)=>{
  let relative;try{relative=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname)}catch{res.writeHead(400);res.end();return}
  if(relative==="/")relative="/index.html";
  const file=path.resolve(build,"."+relative);if(!file.startsWith(build+path.sep)){res.writeHead(403);res.end();return}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return}
   const types={".html":"text/html",".js":"application/javascript",".css":"text/css",".svg":"image/svg+xml",".webp":"image/webp",".png":"image/png"};
   res.setHeader("Content-Type",types[path.extname(file)]||"application/octet-stream");res.end(data);
  });
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 baseURL="http://127.0.0.1:"+server.address().port+"/";
}

const bridgeAudit=[];
const rows=f=>f.gate.locator(".mop108-record");
const declaration=f=>f.gate.locator("#mop108-declaration");
const submit=f=>f.gate.locator(".mop108-submit");
const refresh=f=>f.gate.locator(".mop108-refresh");
async function ready(f){
 const boxes=rows(f).locator('input[type="checkbox"]');
 for(let i=0;i<await boxes.count();i++)await boxes.nth(i).check();
 await declaration(f).check();
}
async function noneRead(f){
 const boxes=rows(f).locator('input[type="checkbox"]');
 for(let i=0;i<await boxes.count();i++)await expect(boxes.nth(i)).not.toBeChecked();
 await expect(declaration(f)).not.toBeChecked();
}
async function dispose(f){
 bridgeAudit.push(await f.page.evaluate(()=>({calls:window.__startupQA.calls,inputs:window.__startupQA.inputs,windowCommands:window.__startupQA.windowCommands})));
 await f.context.close();
}
async function chrome(f,label){
 const data=await f.page.evaluate(()=>{
  const get=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
  const controls=[...document.querySelectorAll(".ref-window-actions button")].map(e=>{const r=get(e),hit=document.elementFromPoint(r.x+r.w/2,r.y+r.h/2);return{label:e.getAttribute("aria-label"),...r,receivesPointer:hit===e||e.contains(hit)}});
  const dialog=document.querySelector(".mop108-dialog"),footer=document.querySelector(".mop108-footer");
  return{w:innerWidth,h:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollY,controls,dialog:dialog?get(dialog):null,footer:footer?get(footer):null};
 });
 assert.ok(data.scrollWidth<=data.w,label+": no horizontal overflow");
 assert.equal(data.scrollY,0,label+": no outer scrolling");
 assert.ok(data.dialog&&data.dialog.y>=0&&data.dialog.bottom<=data.h+1,label+": gate fits viewport");
 assert.ok(data.footer&&data.footer.y>=0&&data.footer.bottom<=data.h+1,label+": confirmation controls fit viewport");
 assert.equal(data.controls.length,3,label+": native bar controls exist");
 for(const c of data.controls){assert.ok(c.w>0&&c.h>0&&c.x>=0&&c.y>=0&&c.right<=data.w&&c.bottom<=data.h,label+": "+c.label+" is within viewport");assert.ok(c.receivesPointer,label+": "+c.label+" receives pointer")}
 return data;
}
async function run(){
 await startServer();browser=await chromium.launch({headless:true});
 const f=await fixture({holdSnapshot:true});
 await check("Initial loading keeps the mandatory gate and window controls available",async()=>{
  await expect(f.gate.locator(".mop108-loading")).toBeVisible();await expect(submit(f)).toBeDisabled();
  await expect(f.page.getByRole("navigation",{name:"Navega\u00e7\u00e3o principal"})).toHaveCount(0);
  await chrome(f,"initial loading");await capture(f.page,"startup-loading-1440.png");
  await f.page.evaluate(()=>{const q=window.__startupQA;q.holdSnapshot=false;q.releaseSnapshot(0)});
  await expect(rows(f)).toHaveCount(4);
 });
 await check("Priorities appear first and continuity details retain their meaning",async()=>{
  const ids=await rows(f).evaluateAll(nodes=>nodes.map(node=>node.getAttribute("data-record-id")));
  assert.deepEqual(ids,["QA-GATE-006","QA-GATE-002","QA-GATE-010","QA-GATE-004"]);
  const urgent=f.gate.locator('[data-record-id="QA-GATE-002"]'),overdue=f.gate.locator('[data-record-id="QA-GATE-006"]');
  for(const text of ["Port\u00e3o de servi\u00e7o indispon\u00edvel","Unidade Central","Equipe t\u00e9cnica","Confirmar retorno do t\u00e9cnico \u00e0s 14h.","Acesso isolado e t\u00e9cnico acionado."])await expect(urgent).toContainText(text);
  await expect(urgent).toContainText(/14:00/);await expect(overdue).toContainText(/vencid/i);
  await expect(overdue).toContainText(/n\u00e3o informado|n\u00e3o informada|a definir|sem respons\u00e1vel/i);
  await expect(f.gate).toContainText("Operador anterior");
  await expect(f.gate).toContainText("Acompanhar o port\u00e3o e confirmar inspe\u00e7\u00e3o hidr\u00e1ulica.");
  await capture(f.page,"startup-desktop-1440.png");
 });
 await check("Every record and the declaration are required, including noncritical completed items",async()=>{
  await expect(submit(f)).toBeDisabled();await declaration(f).check();await expect(submit(f)).toBeDisabled();
  for(const id of ["QA-GATE-006","QA-GATE-002","QA-GATE-010"])await f.gate.getByRole("checkbox",{name:"Li este registro "+id,exact:true}).check();
  await expect(submit(f)).toBeDisabled();
  await f.gate.getByRole("checkbox",{name:"Li este registro QA-GATE-004",exact:true}).check();await expect(submit(f)).toBeEnabled();
  await declaration(f).uncheck();await expect(submit(f)).toBeDisabled();await declaration(f).check();await expect(submit(f)).toBeEnabled();
 });
 await check("Tab wraps inside the gate and Escape cannot bypass acknowledgement",async()=>{
  const points=await f.page.evaluate(()=>{
   const scope=document.querySelector(".mop108-backdrop");
   const nodes=[...scope.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),a[href]')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=="hidden");
   nodes[0].setAttribute("data-qa-focus-first","true");nodes.at(-1).setAttribute("data-qa-focus-last","true");
   return nodes.length;
  });assert.ok(points>=5);
  const first=f.page.locator('[data-qa-focus-first="true"]'),last=f.page.locator('[data-qa-focus-last="true"]');
  await last.focus();await f.page.keyboard.press("Tab");await expect(first).toBeFocused();
  await first.focus();await f.page.keyboard.press("Shift+Tab");await expect(last).toBeFocused();
  await f.page.keyboard.press("Escape");await expect(f.gate).toBeVisible();
  await expect(f.page.getByRole("navigation",{name:"Navega\u00e7\u00e3o principal"})).toHaveCount(0);
  assert.equal(await f.page.evaluate(()=>window.__startupQA.calls.receive),0);
 });
 await check("Window actions and close-dialog cancellation preserve the gate and checked state",async()=>{
  await f.page.getByRole("button",{name:"Minimizar janela",exact:true}).click();
  await f.page.getByRole("button",{name:"Maximizar janela",exact:true}).click();
  await f.page.getByRole("button",{name:"Restaurar janela",exact:true}).click();
  const close=f.page.getByRole("button",{name:"Fechar janela",exact:true}),dialog=f.page.getByRole("alertdialog",{name:"Encerrar o MOP?"});
  await close.click();await expect(dialog).toBeVisible();await expect(dialog.getByRole("button",{name:"Cancelar",exact:true})).toBeFocused();
  await capture(f.page,"startup-close-dialog.png");
  await dialog.getByRole("button",{name:"Cancelar",exact:true}).click();await expect(dialog).toBeHidden();await expect(close).toBeFocused();
  await expect(f.gate).toBeVisible();await expect(submit(f)).toBeEnabled();
  await close.click();await expect(dialog).toBeVisible();await f.page.keyboard.press("Escape");await expect(dialog).toBeHidden();await expect(f.gate).toBeVisible();
  await expect(declaration(f)).toBeChecked();await expect(submit(f)).toBeEnabled();
  assert.deepEqual(await f.page.evaluate(()=>window.__startupQA.windowCommands),["minimize","maximize","maximize"]);
  await chrome(f,"after close dialog");
 });
 await check("One confirmation sends the exact reviewed IDs, critical versions and snapshot token",async()=>{
  await f.page.evaluate(()=>{window.__startupQA.holdReceive=true});
  await submit(f).evaluate(button=>{button.click();button.click()});
  await expect.poll(()=>f.page.evaluate(()=>window.__startupQA.calls.receive)).toBe(1);
  await expect(submit(f)).toBeDisabled();await expect(refresh(f)).toBeDisabled();await expect(f.gate).toBeVisible();
  const input=await f.page.evaluate(()=>window.__startupQA.inputs[0]);
  assert.deepEqual([...input.confirmedIds].sort(),["QA-GATE-002","QA-GATE-004","QA-GATE-006","QA-GATE-010"]);assert.equal(new Set(input.confirmedIds).size,4);
  assert.deepEqual(input.readVersions,{"QA-GATE-006":"2026-11-25T14:05:00.000Z","QA-GATE-002":"2026-11-25T14:10:00.000Z"});
  assert.equal(input.deliveryId,510);assert.equal(input.shiftId,"2026-11-25/Diurno");assert.equal(input.token,"startup-token-v1");assert.equal(input.bootstrap,false);
  await capture(f.page,"startup-saving.png");
  await f.page.evaluate(()=>{const q=window.__startupQA;q.holdReceive=false;q.releaseReceive(0)});
  await expect(f.gate).toBeHidden();await expect(f.page.getByRole("navigation",{name:"Navega\u00e7\u00e3o principal"})).toBeVisible();
 });
 await dispose(f);
 const refreshed=await fixture();await expect(rows(refreshed)).toHaveCount(4);await ready(refreshed);
 await check("Refresh blocks stale acceptance and a changed token clears all confirmations",async()=>{
  await refreshed.page.evaluate(()=>{const q=window.__startupQA;q.holdSnapshot=true;q.snapshot.token="startup-token-v2";q.snapshot.items.find(x=>x.id==="QA-GATE-002").version="2026-11-25T15:01:00.000Z"});
  await refresh(refreshed).click();await expect(submit(refreshed)).toBeDisabled();await expect(refresh(refreshed)).toBeDisabled();
  await submit(refreshed).evaluate(button=>button.click());assert.equal(await refreshed.page.evaluate(()=>window.__startupQA.calls.receive),0);
  await refreshed.page.evaluate(()=>{const q=window.__startupQA;q.holdSnapshot=false;q.releaseSnapshot(0)});
  await expect(refresh(refreshed)).toBeEnabled();await noneRead(refreshed);await expect(submit(refreshed)).toBeDisabled();
 });
 await check("Failed refresh invalidates previously reviewed data until a successful retry",async()=>{
  await ready(refreshed);await refreshed.page.evaluate(()=>{window.__startupQA.failSnapshot=true});
  await refresh(refreshed).click();await expect(refreshed.gate.getByRole("alert")).toContainText("Falha simulada ao consultar a central.");
  await expect(submit(refreshed)).toBeDisabled();await submit(refreshed).evaluate(button=>button.click());
  assert.equal(await refreshed.page.evaluate(()=>window.__startupQA.calls.receive),0);
  await capture(refreshed.page,"startup-refresh-error.png");
  await refreshed.page.evaluate(()=>{window.__startupQA.failSnapshot=false});
  await refresh(refreshed).click();await expect(refresh(refreshed)).toBeEnabled();await noneRead(refreshed);await expect(submit(refreshed)).toBeDisabled();
 });
 await check("Failed receipt leaves access blocked and requires fresh review before another attempt",async()=>{
  await ready(refreshed);await refreshed.page.evaluate(()=>{window.__startupQA.failReceive=true});
  await submit(refreshed).click();await expect(refreshed.gate.getByRole("alert")).toContainText("Falha simulada ao registrar recebimento.");
  await expect(refreshed.gate).toBeVisible();await expect(refreshed.page.getByRole("navigation",{name:"Navega\u00e7\u00e3o principal"})).toHaveCount(0);
  await expect(submit(refreshed)).toBeDisabled();
  await refreshed.page.evaluate(()=>{window.__startupQA.failReceive=false});
  await refresh(refreshed).click();await expect(refresh(refreshed)).toBeEnabled();await noneRead(refreshed);
  assert.equal(await refreshed.page.evaluate(()=>window.__startupQA.calls.receive),1);
 });
 await check("Compact and narrow layouts keep reading and confirmation controls reachable",async()=>{
  for(const size of [{width:1024,height:640},{width:390,height:844}]){
   await refreshed.page.setViewportSize(size);await flush(refreshed.page);await chrome(refreshed,"responsive "+size.width);
   const body=refreshed.gate.locator(".mop108-body");
   await body.evaluate(e=>{e.scrollTop=0});await flush(refreshed.page);await capture(refreshed.page,"startup-"+size.width+".png");
   await body.evaluate(e=>{e.scrollTop=e.scrollHeight});await flush(refreshed.page);await chrome(refreshed,"responsive scrolled "+size.width);
   await ready(refreshed);await expect(submit(refreshed)).toBeEnabled();await chrome(refreshed,"responsive checked "+size.width);
   await body.evaluate(e=>{e.scrollTop=0});await flush(refreshed.page);
   await refresh(refreshed).click();await expect(refresh(refreshed)).toBeEnabled();await noneRead(refreshed);
  }
 });
 await dispose(refreshed);
 const self=await fixture({snapshot:{selfDelivery:true}});
 await check("The outgoing operator cannot accept their own delivery",async()=>{
  await expect(rows(self)).toHaveCount(4);await ready(self);await expect(submit(self)).toBeDisabled();
  await expect(self.gate).toContainText(/outra conta|pr\u00f3pria entrega/i);await submit(self).evaluate(button=>button.click());
  assert.equal(await self.page.evaluate(()=>window.__startupQA.calls.receive),0);await capture(self.page,"startup-self-delivery.png");
 });await dispose(self);
 const local=await fixture({snapshot:{deliveryId:null,outgoing:null,deliverySummary:"",canBootstrap:true,items:[],createdCount:0,criticalCount:0,openCount:0,availableRecords:0,centralVerified:false,syncStatus:"offline",syncReason:"Conex\u00e3o indispon\u00edvel."}});
 await check("An empty local snapshot is explicit and bootstrap still requires acknowledgement",async()=>{
  await expect(rows(local)).toHaveCount(0);await expect(submit(local)).toBeDisabled();await expect(local.gate).toContainText(/local/i);
  await expect(local.gate).toContainText(/Conex\u00e3o indispon\u00edvel/);await expect(local.gate).toContainText(/nenhum registro|n\u00e3o h\u00e1 registros|sem registros/i);
  await capture(local.page,"startup-local-empty.png");
  await declaration(local).check();await expect(submit(local)).toBeEnabled();await submit(local).click();
  await expect(local.gate).toBeHidden();
  const input=await local.page.evaluate(()=>window.__startupQA.inputs[0]);
  assert.equal(input.bootstrap,true);assert.equal(input.deliveryId,null);assert.equal(input.shiftId,"2026-11-25/Diurno");assert.equal(input.token,"startup-token-v1");
  assert.deepEqual(input.confirmedIds,[]);assert.deepEqual(input.readVersions,{});
 });await dispose(local);
 const unavailable=await fixture({failSnapshot:true});
 await check("Initial consultation errors remain recoverable without unlocking the application",async()=>{
  await expect(unavailable.gate.getByRole("alert")).toContainText("Falha simulada ao consultar a central.");await expect(submit(unavailable)).toBeDisabled();
  await capture(unavailable.page,"startup-initial-error.png");
  await unavailable.page.evaluate(()=>{window.__startupQA.failSnapshot=false});await refresh(unavailable).click();await expect(rows(unavailable)).toHaveCount(4);
  await noneRead(unavailable);await expect(unavailable.gate).toBeVisible();assert.equal(await unavailable.page.evaluate(()=>window.__startupQA.calls.receive),0);
 });await dispose(unavailable);
 const blocked=await fixture({snapshot:{deliveryId:null,outgoing:null,canBootstrap:false}});
 await check("Missing delivery without bootstrap permission cannot be bypassed",async()=>{
  await expect(rows(blocked)).toHaveCount(4);await ready(blocked);await expect(submit(blocked)).toBeDisabled();
  await submit(blocked).evaluate(button=>button.click());assert.equal(await blocked.page.evaluate(()=>window.__startupQA.calls.receive),0);
 });await dispose(blocked);
 await check("All gate scenarios stay isolated from operational writes and external services",async()=>{
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);for(const item of bridgeAudit)assert.equal(item.calls.unexpected,0);
 });
 const report={status:"passed",version,checks:checks.length,details:checks,uiBuild:build,uiIndexSHA256:hash(path.join(build,"index.html")),
  uiAssets:fs.readdirSync(path.join(build,"assets")).filter(name=>/\.(?:js|css)$/.test(name)).sort().map(name=>({file:"assets/"+name,sha256:hash(path.join(build,"assets",name))})),
  testSHA256:hash(__filename),screenshots,bridgeAudit,externalRequests:external.length,pageErrors:errors,
  runtime:"Playwright Chromium with synthetic Electron startup and window bridges",
  isolation:"Fake account and snapshot; loopback only; no real profile/database/receipt",
  limitation:"Backend receipt persistence and OS window actions are verified separately"};
 fs.writeFileSync(path.join(output,"startup-ui-report.json"),JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({status:report.status,checks:report.checks,output}));
}
run().catch(async error=>{
 if(lastPage&&!lastPage.isClosed())await capture(lastPage,"startup-failure.png").catch(()=>{});
 fs.writeFileSync(path.join(output,"startup-ui-report.json"),JSON.stringify({status:"failed",version,checks:checks.length,details:checks,error:error.stack,screenshots,external,pageErrors:errors,bridgeAudit},null,2)+"\n");
 console.error(error);process.exitCode=1;
}).finally(async()=>{await browser?.close().catch(()=>{});if(server)await new Promise(resolve=>server.close(resolve))});
