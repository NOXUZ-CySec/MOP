"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {chromium,expect}=require(process.env.MOP_PLAYWRIGHT_MODULE||"@playwright/test");
const root=path.resolve(__dirname,".."),output=path.join(root,"test-results/release110"),shots=path.join(output,"screenshots");
const version=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8").replace(/^\uFEFF/,"")).version;
const checks=[],errors=[],external=[];let browser,lastPage;
fs.mkdirSync(shots,{recursive:true});
const flush=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function check(name,fn){await fn();checks.push({name,status:"passed"});console.log("PASS "+name);}
async function capturePanel(page,panel,name){const viewport=page.viewportSize(),box=await panel.boundingBox();await page.setViewportSize({...viewport,height:Math.max(viewport.height,Math.ceil((box?.height||0)+200),3200)});await panel.scrollIntoViewIfNeeded();await panel.screenshot({path:path.join(shots,name)});await page.setViewportSize(viewport);}
async function fixture(options={}){
 const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:"reduce"});
 await context.route("**/*",route=>{
  const url=new URL(route.request().url());
  if(["127.0.0.1","localhost"].includes(url.hostname))return route.continue();
  external.push(url.origin);return route.abort();
 });
 await context.addInitScript(options=>{
  const noop=()=>()=>{},sync=new Set(),locked=new Set();
  const baseItems=[
   {id:"MOP-QA-001",title:"Falha no port\u00e3o de servi\u00e7o",description:"Abertura manual mantida; acesso monitorado pela portaria.",status:"Pendente",category:"Seguran\u00e7a",occurredAt:"25/11/2026, 08:10",priority:"Urgente",critical:true,assignee:"Equipe t\u00e9cnica",nextAction:"Confirmar retorno t\u00e9cnico \u00e0s 14h.",readVersion:"2026-11-25T14:10:00.000Z",condo:"Unidade QA",deadline:"2026-11-25T17:00:00.000Z",actionTaken:"T\u00e9cnico acionado e acesso isolado.",sourcePriority:"Urgente",updatedAt:"2026-11-25T14:10:00.000Z",missingAssignee:false,missingNextAction:false,overdue:false,dueSoon:false,stale:false,canEditContinuity:true},
   {id:"MOP-QA-002",title:"Vazamento na casa de bombas",description:"Vazamento reduzido ap\u00f3s fechamento parcial do registro.",status:"Em andamento",category:"Manuten\u00e7\u00e3o",occurredAt:"25/11/2026, 07:20",priority:"Urgente",critical:true,assignee:"",nextAction:"",readVersion:"2026-11-25T14:05:00.000Z",condo:"Unidade QA",deadline:"2026-11-25T14:00:00.000Z",actionTaken:"\u00c1rea sinalizada.",sourcePriority:"Normal",updatedAt:"2026-11-25T14:05:00.000Z",missingAssignee:true,missingNextAction:true,overdue:true,dueSoon:false,stale:true,canEditContinuity:true},
   {id:"MOP-QA-003",title:"Acompanhar entrega de encomendas",description:"Entrega prevista no hor\u00e1rio combinado com o morador.",status:"Em andamento",category:"Portaria",occurredAt:"25/11/2026, 10:00",priority:"Normal",critical:false,assignee:"Portaria",nextAction:"Confirmar chegada e avisar o morador.",readVersion:"2026-11-25T14:20:00.000Z",condo:"Unidade QA",deadline:"2026-11-25T15:30:00.000Z",actionTaken:"Hor\u00e1rio confirmado.",sourcePriority:"Normal",updatedAt:"2026-11-25T14:20:00.000Z",missingAssignee:false,missingNextAction:false,overdue:false,dueSoon:true,stale:false,canEditContinuity:true},
   {id:"MOP-QA-004",title:"Revis\u00e3o de ilumina\u00e7\u00e3o externa",description:"L\u00e2mpada da alameda precisa de confer\u00eancia no fim da tarde.",status:"Pendente",category:"Manuten\u00e7\u00e3o",occurredAt:"25/11/2026, 09:30",priority:"Normal",critical:false,assignee:"",nextAction:"Testar acionamento ap\u00f3s as 18h.",readVersion:"2026-11-25T14:25:00.000Z",condo:"Unidade QA",deadline:null,actionTaken:"Registro para acompanhamento.",sourcePriority:"Normal",updatedAt:"2026-11-25T14:25:00.000Z",missingAssignee:true,missingNextAction:false,overdue:false,dueSoon:false,stale:false,canEditContinuity:false}
  ];
  const count=items=>({open:items.length,critical:items.filter(x=>x.critical).length,overdue:items.filter(x=>x.overdue).length,created:2,updated:1,soon:items.filter(x=>x.dueSoon).length,stale:items.filter(x=>x.stale).length,missingAssignee:items.filter(x=>!x.assignee.trim()).length,missingNextAction:items.filter(x=>!x.nextAction.trim()).length,continuityReady:items.filter(x=>x.assignee.trim()&&x.nextAction.trim()).length,changedSinceDelivery:0});
  const base={stage:"delivery",shift:"Diurno",date:"25/11/2026",period:"06:00 \u2013 18:00",outgoing:"Operador alpha",incoming:null,items:baseItems,deliverySummary:"",receiptNote:"",reviewToken:"review-1",shiftId:"2026-11-25/Diurno",updatedAt:"2026-11-25T15:00:00.000Z",deliveredAt:null,deliveredShift:null,deliveredItems:[],changes:[],counts:count(baseItems)};
  const q=window.__handoverQA={user:"alpha",role:"operator",failSnapshot:false,failAction:null,holdSnapshots:false,holdCommand:false,online:true,
   calls:{snapshot:0,deliver:0,receive:0,assignPending:0,unexpected:0,records:0},inputs:[],pendingSnapshots:[],pendingCommands:[],...options};
  q.snapshot=structuredClone({...base,...options.snapshot});
  if(["receipt","awaiting-receipt"].includes(q.snapshot.stage)&&!options.snapshot?.deliveredItems)q.snapshot.deliveredItems=structuredClone(q.snapshot.items).map(item=>({...item,canEditContinuity:false}));
  q.snapshot.counts=count(q.snapshot.items);q.pendingRecords=[];q.holdRecords=false;q.omitRecord=null;
  q.releaseRecords=(index=0)=>{const item=q.pendingRecords[index];if(!item||item.done)throw Error("No held records "+index);item.done=true;item.resolve(item.snapshot);};
  q.seed=structuredClone(q.snapshot);
  q.sync=()=>sync.forEach(fn=>fn({dataChanged:true}));
  q.lock=()=>locked.forEach(fn=>fn());
  q.releaseSnapshot=(index=0)=>{const item=q.pendingSnapshots[index];if(!item||item.done)throw Error("No held snapshot "+index);item.done=true;item.resolve(item.snapshot);};
  q.releaseCommand=(index=0)=>{const item=q.pendingCommands[index];if(!item||item.done)throw Error("No held command "+index);item.done=true;item.resolve(item.apply());};
  q.patch=(patch)=>{Object.assign(q.snapshot,patch);q.snapshot.counts=count(q.snapshot.items);};
  q.changeItem=(id,patch)=>{const item=q.snapshot.items.find(x=>x.id===id);Object.assign(item,patch);q.snapshot.reviewToken+="x";q.snapshot.counts=count(q.snapshot.items);};
  const account=()=>({authenticated:true,role:q.role,userId:"qa-"+q.user,username:q.user,display_name:"Operador "+q.user,mode:q.online?"online":"offline",condos:["Unidade QA"]});
  const records=()=>({items:q.snapshot.items.map((item,index)=>({id:101+index,protocol:item.id,subject:item.title,description:item.description,category:item.category,status:item.status,priority:item.sourcePriority,created_at:"2026-11-25T11:00:00.000Z",updated_at:"2026-11-25T14:00:00.000Z",created_by:"Operador "+q.user,created_identity:{user_id:item.canEditContinuity?"qa-"+q.user:"qa-other"},condo:item.condo,assignee:item.assignee,next_action:item.nextAction,action_taken:item.actionTaken,deadline:item.deadline}))});
  window.mopDesktop={
   initialize:async()=>account(),
   onLocked:fn=>{locked.add(fn);return()=>locked.delete(fn);},
   onSync:fn=>{sync.add(fn);return()=>sync.delete(fn);},
   onAlert:noop,onResume:noop,
   notifications:async()=>({history:[]}),home109:async()=>({date:"2026-11-25",scope:"local",tasks:[]}),
   read48:async()=>{q.calls.records++;const value=records();value.items=value.items.filter(item=>item.protocol!==q.omitRecord);return q.holdRecords?new Promise(resolve=>q.pendingRecords.push({resolve,snapshot:value,done:false})):value;},
   startup108:async()=>({shiftId:q.snapshot.shiftId,shiftLabel:"Turno QA",deliveryId:null,outgoing:null,deliverySummary:"",selfDelivery:false,canBootstrap:true,token:"synthetic",items:[],createdCount:0,criticalCount:0,openCount:0,availableRecords:q.snapshot.items.length,centralVerified:true,syncStatus:"connected",accepted:true,acceptedAt:"2026-11-25T12:00:00.000Z"}),
   auth:async(action,input)=>{if(action==="login"){q.user=input.login;q.snapshot=structuredClone(q.seed);q.snapshot.outgoing="Operador "+q.user;return account();}return{authenticated:false};},
   handover36:async(action,input={})=>{
    if(action==="snapshot"){q.calls.snapshot++;if(q.failSnapshot)throw Error("Falha simulada ao atualizar a passagem.");const snapshot=structuredClone(q.snapshot);return q.holdSnapshots?new Promise(resolve=>q.pendingSnapshots.push({resolve,snapshot,done:false})):snapshot;}
    if(!["deliver","receive","assignPending"].includes(action)){q.calls.unexpected++;throw Error("Unexpected handover action: "+action);}
    q.calls[action]++;q.inputs.push({action,input:structuredClone(input)});
    if(q.failAction===action)throw Error("Falha simulada na opera\u00e7\u00e3o "+action+".");
    const apply=()=>{
     const syncState=q.online?"online":"offline";
     if(action==="assignPending"){
      const item=q.snapshot.items.find(x=>x.id===input.protocol);
      if(!item||!item.canEditContinuity||item.readVersion!==input.readVersion)throw Error("Dados alterados. Atualize a passagem.");
      item.assignee=input.assignee.trim();item.nextAction=input.nextAction.trim();item.missingAssignee=!item.assignee;item.missingNextAction=!item.nextAction;item.readVersion=new Date(Date.parse(item.readVersion)+1000).toISOString();item.updatedAt=item.readVersion;
      q.snapshot.reviewToken+="x";q.snapshot.counts=count(q.snapshot.items);
      return{id:101+q.snapshot.items.indexOf(item),protocol:item.id,action,changed:true,readVersion:item.readVersion,at:"2026-11-25T15:00:01.000Z",syncState};
     }
     if(action==="deliver"){
      q.snapshot={...q.snapshot,stage:"awaiting-receipt",deliveryId:410,deliverySummary:input.summary,deliveredAt:"2026-11-25T15:00:01.000Z",deliveredShift:{id:q.snapshot.shiftId,type:"Diurno",date:q.snapshot.date,period:q.snapshot.period},deliveredItems:structuredClone(q.snapshot.items).map(x=>({...x,canEditContinuity:false})),reviewToken:q.snapshot.reviewToken+"x"};
      return{id:410,action,at:q.snapshot.deliveredAt,syncState};
     }
     q.snapshot={...q.snapshot,stage:"delivery",deliveryId:undefined,deliverySummary:"",receiptNote:"",deliveredItems:[],deliveredAt:null,deliveredShift:null,reviewToken:q.snapshot.reviewToken+"x"};
     return{id:410,action,at:"2026-11-25T15:00:01.000Z",syncState};
    };
    return q.holdCommand?new Promise(resolve=>q.pendingCommands.push({resolve,apply,done:false})):apply();
   },
   recordAction96:async()=>{q.calls.unexpected++;throw Error("Record writes are forbidden in handover QA");},
   write32:async()=>{q.calls.unexpected++;throw Error("Generic writes are forbidden in handover QA");}
  };
  window.mopWindow={command:async()=>({maximized:false}),state:async()=>({maximized:false}),status:async()=>({maximized:false}),onState:noop,onCloseRequest:noop};
 },options);
 const page=lastPage=await context.newPage();
 page.on("pageerror",error=>errors.push(error.message));
 await page.clock.setFixedTime(new Date("2026-11-25T15:00:00Z"));
 await page.goto(process.env.MOP_HANDOVER110_URL||"http://127.0.0.1:5180/");
 const nav=page.getByRole("navigation",{name:"Navega\u00e7\u00e3o principal"});
 await expect(nav).toBeVisible();await nav.getByRole("button",{name:"Passagem de Turno",exact:true}).click();
 const panel=page.locator(".handover110-operational");
 await expect(panel).toBeVisible();
 if(!options.failSnapshot)await expect(panel.getByRole("heading",{name:"Passagem de Turno",exact:true})).toBeVisible();
 return{context,page,nav,panel};
}
async function runTests(){
 const unexpected=[],allFixtures=[];
 const make=async options=>{const f=await fixture(options);allFixtures.push(f);return f;};
 const dispose=async f=>{unexpected.push(await f.page.evaluate(()=>window.__handoverQA.calls.unexpected));await f.context.close();};
 const rows=f=>f.panel.locator(".handover110-item");
 const item=(f,id)=>rows(f).filter({has:f.page.locator(".handover110-item-meta b",{hasText:id})});
 const expand=async(f,id)=>{const row=item(f,id);if(await row.locator(".handover110-item-toggle").getAttribute("aria-expanded")!=="true")await row.locator(".handover110-item-toggle").click();return row;};
 const summary=f=>f.panel.getByRole("textbox",{name:"Resumo para o pr\u00f3ximo plant\u00e3o",exact:true});
 const submit=f=>f.panel.getByRole("button",{name:"Registrar entrega do turno",exact:true});
 const refresh=async f=>{await f.panel.getByRole("button",{name:"Atualizar dados",exact:true}).click();await expect(f.panel.getByRole("button",{name:"Atualizar dados",exact:true})).toBeEnabled();};
 const checksAll=async f=>{const boxes=f.panel.locator(".handover110-checklist input[type=checkbox]");for(let i=0;i<await boxes.count();i++)await boxes.nth(i).check();};
 const allChecked=async f=>{const boxes=f.panel.locator(".handover110-checklist input[type=checkbox]");for(let i=0;i<await boxes.count();i++)await expect(boxes.nth(i)).toBeChecked();};
 const noneChecked=async f=>{const boxes=f.panel.locator(".handover110-checklist input[type=checkbox]");for(let i=0;i<await boxes.count();i++)await expect(boxes.nth(i)).not.toBeChecked();};
 const filter=async(f,name)=>f.panel.getByRole("group",{name:"Filtrar pend\u00eancias"}).getByRole("button",{name:new RegExp("^"+name)}).click();
 const ready=async(f,value="Port\u00e3o acompanhado pela equipe. Confirmar retorno t\u00e9cnico e definir respons\u00e1vel pelo vazamento.")=>{await summary(f).fill(value);await checksAll(f);await expect(submit(f)).toBeEnabled();};
 const receiptOptions={snapshot:{stage:"receipt",deliveryId:410,outgoing:"Operador do plant\u00e3o anterior",incoming:"Operador alpha",deliverySummary:"Port\u00e3o acompanhado. Conferir retorno t\u00e9cnico e passagem da manuten\u00e7\u00e3o.",deliveredAt:"2026-11-25T10:55:00.000Z",deliveredShift:{id:"2026-11-24/Noturno",type:"Noturno",date:"2026-11-24",period:"18:00 \u2013 06:00"}}};
 const f=await make(),{page,panel}=f;
 await check("Shift context, real continuity gaps and risk counts are explicit without mutations",async()=>{
  await expect(panel.getByRole("region",{name:"Contexto do plant\u00e3o"})).toContainText("Operador alpha");
  await expect(panel.getByRole("region",{name:"Contexto do plant\u00e3o"})).toContainText("Diurno");
  await expect(rows(f)).toHaveCount(4);
  for(const [label,count] of [["Pend\u00eancias abertas",4],["Exigem leitura",2],["Prazos vencidos",1],["Orienta\u00e7\u00e3o incompleta",2]]){
   await expect(panel.locator(".handover110-metric").filter({hasText:label}).locator("strong")).toHaveText(String(count));
  }
  await expect(submit(f)).toBeDisabled();
  assert.deepEqual(await page.evaluate(()=>({deliver:window.__handoverQA.calls.deliver,receive:window.__handoverQA.calls.receive,assign:window.__handoverQA.calls.assignPending})),{deliver:0,receive:0,assign:0});
  await capturePanel(page,panel,"handover-delivery-desktop.png");
 });
 await check("Search and risk filters preserve global totals and recover from empty results",async()=>{
  for(const [name,count] of [["Cr\u00edticas",2],["Sem orienta\u00e7\u00e3o",2],["Vencidas",1],["Prazos",3],["Todas",4]]){await filter(f,name);await expect(rows(f)).toHaveCount(count);}
  const search=panel.getByRole("textbox",{name:"Buscar pend\u00eancia",exact:true});
  await search.fill("tecnica");await expect(rows(f)).toHaveCount(1);await expect(item(f,"MOP-QA-001")).toBeVisible();
  await expect(panel.locator(".handover110-metric").filter({hasText:"Pend\u00eancias abertas"}).locator("strong")).toHaveText("4");
  await search.fill("sem correspondencia qa");await expect(rows(f)).toHaveCount(0);
  await expect(panel.getByText("Nenhuma pend\u00eancia encontrada",{exact:true})).toBeVisible();
  await panel.getByRole("button",{name:"Limpar filtros",exact:true}).click();await expect(rows(f)).toHaveCount(4);
 });
 await check("Blank template cannot satisfy delivery quality and missing orientation is advisory",async()=>{
  await panel.getByRole("button",{name:"Usar roteiro",exact:true}).click();await checksAll(f);
  await expect(summary(f)).toHaveValue(/Situa\u00e7\u00e3o geral/);await expect(submit(f)).toBeDisabled();
  await ready(f);
  await expect(panel.locator(".handover110-quality-note")).toContainText("2 pend\u00eancia(s)");
  await expect(panel.getByRole("progressbar",{name:"Requisitos da entrega conferidos"})).toHaveAttribute("value","4");
 });
 await check("Refresh timestamps and navigation preserve text and completed delivery checklist",async()=>{
  const text=await summary(f).inputValue();
  await page.evaluate(()=>window.__handoverQA.patch({updatedAt:"2026-11-25T15:00:10.000Z"}));await refresh(f);
  await expect(summary(f)).toHaveValue(text);await allChecked(f);
  await f.nav.getByRole("button",{name:"In\u00edcio",exact:true}).click();
  await f.nav.getByRole("button",{name:"Passagem de Turno",exact:true}).click();
  await expect(summary(f)).toHaveValue(text);await allChecked(f);
 });
 await check("Inline editing respects per-record permission and blocks submission while dirty",async()=>{
  const readOnly=await expand(f,"MOP-QA-004");await expect(readOnly.getByRole("button",{name:"Editar orienta\u00e7\u00e3o",exact:true})).toHaveCount(0);
  await expect(readOnly).toContainText("autor ou pela supervis\u00e3o");
  const editable=await expand(f,"MOP-QA-002");await editable.getByRole("button",{name:"Editar orienta\u00e7\u00e3o",exact:true}).click();
  await editable.getByRole("textbox",{name:"Respons\u00e1vel pelo acompanhamento",exact:true}).fill("Equipe hidr\u00e1ulica");
  await editable.getByRole("textbox",{name:"Pr\u00f3xima a\u00e7\u00e3o",exact:true}).fill("Inspecionar o registro \u00e0s 14h e informar a supervis\u00e3o.");
  await expect(submit(f)).toBeDisabled();await expect(editable.getByRole("button",{name:"Abrir registro",exact:true})).toBeDisabled();
  await capturePanel(page,panel,"handover-editor-desktop.png");
 });
 await check("Saving continuity sends one versioned command and refreshes quality indicators",async()=>{
  const row=item(f,"MOP-QA-002");
  await page.evaluate(()=>{window.__handoverQA.holdCommand=true;});
  await row.getByRole("button",{name:"Salvar orienta\u00e7\u00e3o",exact:true}).evaluate(button=>{button.click();button.click();});
  await expect.poll(()=>page.evaluate(()=>window.__handoverQA.calls.assignPending)).toBe(1);
  await expect(row.getByRole("button",{name:"Salvar orienta\u00e7\u00e3o",exact:true})).toBeDisabled();
  await page.evaluate(()=>{const q=window.__handoverQA;q.holdCommand=false;q.releaseCommand(0);});
  await expect(row.locator(".handover110-editor")).toHaveCount(0);await expect(row).toContainText("Equipe hidr\u00e1ulica");
  await expect(panel.locator(".handover110-metric").filter({hasText:"Orienta\u00e7\u00e3o incompleta"}).locator("strong")).toHaveText("1");
  const command=await page.evaluate(()=>window.__handoverQA.inputs.find(x=>x.action==="assignPending").input);
  assert.deepEqual(command,{protocol:"MOP-QA-002",readVersion:"2026-11-25T14:05:00.000Z",assignee:"Equipe hidr\u00e1ulica",nextAction:"Inspecionar o registro \u00e0s 14h e informar a supervis\u00e3o."});
  await expect(summary(f)).not.toHaveValue("");await noneChecked(f);
 });
 await check("Failed continuity save retains fields and permits a deliberate retry",async()=>{
  const row=await expand(f,"MOP-QA-003");await row.getByRole("button",{name:"Editar orienta\u00e7\u00e3o",exact:true}).click();
  const next=row.getByRole("textbox",{name:"Pr\u00f3xima a\u00e7\u00e3o",exact:true});await next.fill("Confirmar chegada com a portaria \u00e0s 13h.");
  await page.evaluate(()=>{window.__handoverQA.failAction="assignPending";});
  await row.getByRole("button",{name:"Salvar orienta\u00e7\u00e3o",exact:true}).click();
  await expect(row.getByRole("alert")).toContainText("Falha simulada");await expect(next).toHaveValue("Confirmar chegada com a portaria \u00e0s 13h.");
  await expect(row.getByRole("button",{name:"Salvar orienta\u00e7\u00e3o",exact:true})).toBeEnabled();
  await page.evaluate(()=>{window.__handoverQA.failAction=null;});await row.getByRole("button",{name:"Salvar orienta\u00e7\u00e3o",exact:true}).click();
  await expect(row.locator(".handover110-editor")).toHaveCount(0);await expect(row).toContainText("Confirmar chegada com a portaria \u00e0s 13h.");
 });
 await check("A changed record cannot be overwritten by an older orientation editor",async()=>{
  const row=await expand(f,"MOP-QA-001");await row.getByRole("button",{name:"Editar orienta\u00e7\u00e3o",exact:true}).click();
  await row.getByRole("textbox",{name:"Pr\u00f3xima a\u00e7\u00e3o",exact:true}).fill("Rascunho local que deve ser reconferido.");
  await page.evaluate(()=>{const q=window.__handoverQA;q.changeItem("MOP-QA-001",{readVersion:"2026-11-25T14:20:00.000Z",updatedAt:"2026-11-25T14:20:00.000Z",nextAction:"Orientacao atual recebida da central."});q.sync();});
  await expect(row.getByRole("alert")).toContainText("mudou durante a edi\u00e7\u00e3o");await expect(row.getByRole("button",{name:"Salvar orienta\u00e7\u00e3o",exact:true})).toBeDisabled();
  await expect(row.getByRole("textbox",{name:"Pr\u00f3xima a\u00e7\u00e3o",exact:true})).toHaveValue("Rascunho local que deve ser reconferido.");
  await row.getByRole("button",{name:"Cancelar edi\u00e7\u00e3o",exact:true}).click();await expect(row).toContainText("Orientacao atual recebida da central.");
 });
 await check("Expired risk context invalidates confirmations even without a new review token",async()=>{
  await ready(f);const text=await summary(f).inputValue();
  await page.evaluate(()=>{const q=window.__handoverQA;Object.assign(q.snapshot.items.find(x=>x.id==="MOP-QA-003"),{overdue:true,dueSoon:false,critical:true});q.patch({updatedAt:"2026-11-25T15:31:00.000Z"});q.sync();});
  await noneChecked(f);await expect(summary(f)).toHaveValue(text);await expect(submit(f)).toBeDisabled();
 });
 await check("A failed snapshot blocks delivery while preserving text and retry recovers",async()=>{
  await ready(f);const text=await summary(f).inputValue();
  await page.evaluate(()=>{window.__handoverQA.failSnapshot=true;});await refresh(f);
  await expect(panel.getByRole("alert").first()).toContainText("Falha simulada");await expect(submit(f)).toBeDisabled();await expect(summary(f)).toHaveValue(text);
  await page.evaluate(()=>{window.__handoverQA.failSnapshot=false;});await refresh(f);await expect(submit(f)).toBeEnabled();
 });
 await check("Opening a record waits for a forced fresh read and preserves the handover draft",async()=>{
  const text=await summary(f).inputValue();
  await page.evaluate(()=>{const q=window.__handoverQA;q.omitRecord="MOP-QA-003";q.sync();});await flush(page);
  await f.nav.getByRole("button",{name:"Registros",exact:true}).click();await expect(page.locator("[data-record-row]")).toHaveCount(3);
  await f.nav.getByRole("button",{name:"Passagem de Turno",exact:true}).click();await expect(summary(f)).toHaveValue(text);
  await page.evaluate(()=>{const q=window.__handoverQA;q.omitRecord=null;q.holdRecords=true;});
  const row=await expand(f,"MOP-QA-003");await row.getByRole("button",{name:"Abrir registro",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__handoverQA.pendingRecords.length)).toBeGreaterThan(0);
  await expect(page.getByText(/registro.*n\u00e3o.*localizado/i)).toHaveCount(0);
  await page.evaluate(()=>{const q=window.__handoverQA;q.holdRecords=false;for(let i=0;i<q.pendingRecords.length;i++)if(!q.pendingRecords[i].done)q.releaseRecords(i);});
  await expect(page.getByRole("complementary",{name:"Detalhes do registro"})).toContainText("Registro #MOP-QA-003");
  await expect(page.getByRole("complementary",{name:"Detalhes do registro"})).toContainText("Acompanhar entrega de encomendas");
  await f.nav.getByRole("button",{name:"Passagem de Turno",exact:true}).click();await expect(summary(f)).toHaveValue(text);
 });
 await check("Delivery dialog supports cancellation, Escape, focus trap and focus restoration",async()=>{
  await ready(f);const trigger=submit(f),dialog=page.getByRole("alertdialog",{name:"Confirmar entrega do turno",exact:true});
  await trigger.click();await expect(dialog).toBeVisible();
  const cancel=dialog.getByRole("button",{name:"Cancelar",exact:true}),confirm=dialog.getByRole("button",{name:"Confirmar entrega",exact:true});
  await expect(cancel).toBeFocused();await page.keyboard.press("Shift+Tab");await expect(confirm).toBeFocused();await page.keyboard.press("Tab");await expect(cancel).toBeFocused();
  await page.screenshot({path:path.join(shots,"handover-confirm-desktop.png"),fullPage:true});
  await cancel.click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
  await trigger.click();await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();await expect(panel.getByRole("heading",{name:"Passagem de Turno",exact:true})).toBeVisible();
  assert.equal(await page.evaluate(()=>window.__handoverQA.calls.deliver),0);
 });
 await check("Material changes during confirmation cancel the intent and require a fresh review",async()=>{
  await submit(f).click();await expect(page.getByRole("alertdialog",{name:"Confirmar entrega do turno",exact:true})).toBeVisible();
  await page.evaluate(()=>{const q=window.__handoverQA;q.changeItem("MOP-QA-004",{readVersion:"2026-11-25T14:35:00.000Z",description:"Informacao atualizada durante a confirmacao."});q.sync();});
  await expect(page.getByRole("alertdialog")).toHaveCount(0);await expect(panel.locator(".handover110-review-message")).toContainText("mudaram durante");
  await noneChecked(f);await expect(submit(f)).toBeDisabled();assert.equal(await page.evaluate(()=>window.__handoverQA.calls.deliver),0);
 });
 await check("Delivery deduplicates confirmation and clearly distinguishes pending central synchronization",async()=>{
  await ready(f);const expectedToken=await page.evaluate(()=>window.__handoverQA.snapshot.reviewToken),text=await summary(f).inputValue();
  await page.evaluate(()=>{const q=window.__handoverQA;q.online=false;q.holdCommand=true;});
  await submit(f).click();const dialog=page.getByRole("alertdialog",{name:"Confirmar entrega do turno",exact:true});
  await dialog.getByRole("button",{name:"Confirmar entrega",exact:true}).evaluate(button=>{button.click();button.click();});
  await expect.poll(()=>page.evaluate(()=>window.__handoverQA.calls.deliver)).toBe(1);await expect(dialog.getByRole("button",{name:"Registrando\u2026",exact:true})).toBeDisabled();
  await page.evaluate(()=>{const q=window.__handoverQA;q.holdCommand=false;q.releaseCommand(q.pendingCommands.length-1);});
  await expect(dialog).toHaveCount(0);await expect(panel.locator(".handover110-feedback.is-warning")).toContainText("salva neste computador");
  await expect(panel.locator(".handover110-feedback.is-warning")).toContainText("sincroniza\u00e7\u00e3o com a central ainda est\u00e1 pendente");
  await expect(panel.getByRole("heading",{name:"Aguardando recebimento",exact:true})).toBeVisible();await expect(submit(f)).toHaveCount(0);await expect(summary(f)).toHaveCount(0);
  const input=await page.evaluate(()=>window.__handoverQA.inputs.find(x=>x.action==="deliver").input);
  assert.deepEqual(input,{summary:text.trim(),reviewToken:expectedToken,checklist:["pending","deadlines","continuity"]});
  await capturePanel(page,panel,"handover-awaiting-desktop.png");
 });
 const r=await make(receiptOptions),rp=r.page;
 await check("Frozen delivered guidance remains distinct from updated live records",async()=>{
  await rp.evaluate(()=>{const q=window.__handoverQA;q.changeItem("MOP-QA-001",{assignee:"Equipe do pr\u00f3ximo turno",nextAction:"Aguardar a pe\u00e7a de reposi\u00e7\u00e3o.",readVersion:"2026-11-25T14:40:00.000Z"});q.snapshot.changes=[{id:"MOP-QA-001",kind:"updated",deliveredVersion:"2026-11-25T14:10:00.000Z",currentVersion:"2026-11-25T14:40:00.000Z"}];q.sync();});
  const current=await expand(r,"MOP-QA-001");await expect(current).toContainText("Equipe do pr\u00f3ximo turno");await expect(current).toContainText("Aguardar a pe\u00e7a");
  await expect(r.panel.locator(".handover110-delivery-note")).toHaveText(receiptOptions.snapshot.deliverySummary);
  const frozen=r.panel.locator(".handover110-delivered-records");await frozen.locator("summary").click();
  await expect(frozen).toContainText("Equipe t\u00e9cnica");await expect(frozen).toContainText("Confirmar retorno t\u00e9cnico \u00e0s 14h.");
  await expect(frozen).not.toContainText("Aguardar a pe\u00e7a de reposi\u00e7\u00e3o.");
  await r.panel.locator(".handover110-changes summary").click();await expect(r.panel.locator(".handover110-changes")).toContainText("Atualizada ap\u00f3s a entrega");
  await capturePanel(rp,r.panel,"handover-receipt-desktop.png");
 });
 const receive=()=>r.panel.getByRole("button",{name:"Confirmar recebimento",exact:true});
 await check("Filtering out critical records cannot bypass version-bound receipt readings",async()=>{
  await r.panel.getByRole("textbox",{name:"Buscar pend\u00eancia",exact:true}).fill("encomendas");await expect(rows(r)).toHaveCount(1);await expect(receive()).toBeDisabled();
  await expect(r.panel.locator(".handover110-unread>button")).toHaveCount(2);
  await r.panel.locator(".handover110-unread>button").filter({hasText:"MOP-QA-001"}).click();
  await item(r,"MOP-QA-001").getByRole("checkbox",{name:/Li e compreendi esta pend\u00eancia/}).check();await expect(receive()).toBeDisabled();
  const second=await expand(r,"MOP-QA-002");await second.getByRole("checkbox",{name:/Li e compreendi esta pend\u00eancia/}).check();await expect(receive()).toBeEnabled();
  await expect(r.panel.getByRole("progressbar",{name:"Leituras obrigat\u00f3rias conferidas"})).toHaveAttribute("value","2");
 });
 await check("An updated critical version invalidates only its reading and preserves receipt notes",async()=>{
  const note=r.panel.getByRole("textbox",{name:"Ressalvas no recebimento",exact:true});await note.fill("Confirmar hor\u00e1rio do retorno com a equipe t\u00e9cnica.");
  await rp.evaluate(()=>{const q=window.__handoverQA;q.changeItem("MOP-QA-001",{readVersion:"2026-11-25T14:50:00.000Z",description:"Nova informacao relevante recebida."});q.sync();});
  await expect(r.panel.getByRole("progressbar",{name:"Leituras obrigat\u00f3rias conferidas"})).toHaveAttribute("value","1");await expect(receive()).toBeDisabled();
  await expect(note).toHaveValue("Confirmar hor\u00e1rio do retorno com a equipe t\u00e9cnica.");
  const unchanged=await expand(r,"MOP-QA-002");await expect(unchanged.getByRole("checkbox",{name:/Li e compreendi esta pend\u00eancia/})).toBeChecked();
  const changed=await expand(r,"MOP-QA-001");await expect(changed.getByRole("checkbox",{name:/Li e compreendi esta pend\u00eancia/})).not.toBeChecked();
  await changed.getByRole("checkbox",{name:/Li e compreendi esta pend\u00eancia/}).check();await expect(receive()).toBeEnabled();
 });
 await check("A receipt failure preserves notes and reviewed versions for an explicit retry",async()=>{
  await rp.evaluate(()=>{window.__handoverQA.failAction="receive";});await receive().click();
  await rp.getByRole("alertdialog",{name:"Confirmar recebimento do turno",exact:true}).getByRole("button",{name:"Confirmar recebimento",exact:true}).click();
  await expect(rp.getByRole("alertdialog")).toHaveCount(0);await expect(r.panel.getByRole("alert").first()).toContainText("Falha simulada");
  await expect(r.panel.getByRole("textbox",{name:"Ressalvas no recebimento",exact:true})).toHaveValue("Confirmar hor\u00e1rio do retorno com a equipe t\u00e9cnica.");
  await expect(receive()).toBeEnabled();await rp.evaluate(()=>{window.__handoverQA.failAction=null;});
 });
 await check("Receipt confirmation submits once with only the current mandatory read versions",async()=>{
  const before=await rp.evaluate(()=>window.__handoverQA.calls.receive);
  const expected=await rp.evaluate(()=>Object.fromEntries(window.__handoverQA.snapshot.items.filter(x=>x.critical).map(x=>[x.id,x.readVersion])));
  await rp.evaluate(()=>{window.__handoverQA.holdCommand=true;});await receive().click();
  const dialog=rp.getByRole("alertdialog",{name:"Confirmar recebimento do turno",exact:true});
  await dialog.getByRole("button",{name:"Confirmar recebimento",exact:true}).evaluate(button=>{button.click();button.click();});
  await expect.poll(()=>rp.evaluate(()=>window.__handoverQA.calls.receive)).toBe(before+1);
  await rp.evaluate(()=>{const q=window.__handoverQA;q.holdCommand=false;q.releaseCommand(q.pendingCommands.length-1);});
  await expect(dialog).toHaveCount(0);await expect(r.panel.locator(".handover110-feedback.is-success")).toContainText("confirmado na central");
  const input=await rp.evaluate(()=>window.__handoverQA.inputs.filter(x=>x.action==="receive").at(-1).input);
  assert.deepEqual(input,{deliveryId:410,receiptNote:"Confirmar hor\u00e1rio do retorno com a equipe t\u00e9cnica.",readVersions:expected});
  await expect(summary(r)).toHaveValue("");await dispose(r);lastPage=page;
 });
 const e=await make({snapshot:{items:[]}});
 await check("A shift without open records still permits a meaningful reviewed delivery",async()=>{
  await expect(e.panel.getByText("Sem pend\u00eancias abertas",{exact:true})).toBeVisible();await expect(rows(e)).toHaveCount(0);
  await ready(e,"Plant\u00e3o sem pend\u00eancias. Acessos e equipamentos conferidos; manter acompanhamento de rotina.");
  await expect(e.panel.getByRole("progressbar",{name:"Requisitos da entrega conferidos"})).toHaveAttribute("value","4");await dispose(e);lastPage=page;
 });
 const late=await make();
 await check("Late refresh after unmount cannot replace the fresh view or erase its draft",async()=>{
  await summary(late).fill("Rascunho preservado ao consultar outras abas.");
  await late.page.evaluate(()=>{window.__handoverQA.holdSnapshots=true;});await late.panel.getByRole("button",{name:"Atualizar dados",exact:true}).click();
  await expect.poll(()=>late.page.evaluate(()=>window.__handoverQA.pendingSnapshots.length)).toBe(1);
  await late.page.evaluate(()=>{const q=window.__handoverQA;q.holdSnapshots=false;q.changeItem("MOP-QA-001",{title:"Informacao recente confirmada",readVersion:"2026-11-25T14:55:00.000Z"});});
  await late.nav.getByRole("button",{name:"In\u00edcio",exact:true}).click();await late.nav.getByRole("button",{name:"Passagem de Turno",exact:true}).click();
  await expect(summary(late)).toHaveValue("Rascunho preservado ao consultar outras abas.");await expect(item(late,"MOP-QA-001")).toContainText("Informacao recente confirmada");
  await late.page.evaluate(()=>window.__handoverQA.releaseSnapshot(0));await flush(late.page);
  await expect(item(late,"MOP-QA-001")).toContainText("Informacao recente confirmada");await expect(summary(late)).toHaveValue("Rascunho preservado ao consultar outras abas.");
 });
 await check("Locking and changing account discard the prior draft and its pending snapshot",async()=>{
  await late.page.evaluate(()=>{window.__handoverQA.holdSnapshots=true;});await late.panel.getByRole("button",{name:"Atualizar dados",exact:true}).click();
  await expect.poll(()=>late.page.evaluate(()=>window.__handoverQA.pendingSnapshots.length)).toBe(2);
  await late.page.evaluate(()=>window.__handoverQA.lock());
  await expect(late.page.getByRole("heading",{name:"Bem-vindo ao MOP",exact:true})).toBeVisible();
  await late.page.evaluate(()=>{window.__handoverQA.holdSnapshots=false;});
  await late.page.getByLabel("Usu\u00e1rio ou e-mail",{exact:true}).fill("beta");await late.page.getByLabel("Senha",{exact:true}).fill("qa-only-no-real-login");
  await late.page.getByRole("button",{name:"Entrar no MOP",exact:true}).click();await expect(late.nav).toBeVisible();
  await late.nav.getByRole("button",{name:"Passagem de Turno",exact:true}).click();await expect(summary(late)).toHaveValue("");
  await late.page.evaluate(()=>window.__handoverQA.releaseSnapshot(1));await flush(late.page);
  await expect(summary(late)).toHaveValue("");await expect(late.panel.getByRole("region",{name:"Contexto do plant\u00e3o"})).toContainText("Operador beta");
  await dispose(late);lastPage=page;
 });
 const failed=await make({failSnapshot:true});
 await check("An initial snapshot error exposes recovery without offering a write action",async()=>{
  await expect(failed.panel.getByRole("alert")).toContainText("Falha simulada");await expect(submit(failed)).toHaveCount(0);
  await failed.page.evaluate(()=>{window.__handoverQA.failSnapshot=false;});await failed.panel.getByRole("button",{name:"Tentar novamente",exact:true}).click();
  await expect(summary(failed)).toBeVisible();assert.equal(await failed.page.evaluate(()=>window.__handoverQA.calls.deliver+window.__handoverQA.calls.receive+window.__handoverQA.calls.assignPending),0);
  await dispose(failed);lastPage=page;
 });
 const visual=await make();
 await check("Desktop, compact and keyboard layouts expose all controls without horizontal overflow",async()=>{
  const p=visual.page;
  const row=item(visual,"MOP-QA-002"),toggle=row.locator(".handover110-item-toggle");
  await toggle.focus();await p.keyboard.press("Enter");await expect(toggle).toHaveAttribute("aria-expanded","true");await expect(row.locator(".handover110-description")).toBeVisible();
  await row.getByRole("button",{name:"Editar orienta\u00e7\u00e3o",exact:true}).click();
  await row.getByRole("textbox",{name:"Respons\u00e1vel pelo acompanhamento",exact:true}).fill("Equipe de continuidade");
  await row.getByRole("textbox",{name:"Pr\u00f3xima a\u00e7\u00e3o",exact:true}).fill("Conferir retorno t\u00e9cnico e registrar o resultado para o plant\u00e3o seguinte.");
  for(const width of [1440,1024,390]){
   await p.setViewportSize({width,height:1100});await visual.panel.scrollIntoViewIfNeeded();
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"Horizontal overflow at "+width);
   for(const selector of [".handover110-context",".handover110-queue",".handover110-summary",".handover110-review",".handover110-editor"]){
    const element=visual.panel.locator(selector),box=await element.boundingBox();assert.ok(box&&box.x>=-1&&box.x+box.width<=width+1,selector+" exceeds "+width);
   }
  }
  await p.setViewportSize({width:390,height:2500});await capturePanel(p,visual.panel,"handover-compact.png");
  await p.setViewportSize({width:1440,height:1300});await row.getByRole("button",{name:"Cancelar edi\u00e7\u00e3o",exact:true}).click();await ready(visual);
  await submit(visual).click();const dialog=p.getByRole("alertdialog",{name:"Confirmar entrega do turno",exact:true});
  await p.setViewportSize({width:390,height:844});await expect(dialog).toBeVisible();const box=await dialog.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=391);
  await p.screenshot({path:path.join(shots,"handover-confirm-compact.png"),fullPage:true});
  await p.keyboard.press("Escape");await expect(dialog).toHaveCount(0);await dispose(visual);lastPage=page;
 });
 await check("No JavaScript errors, external requests or unexpected operational actions",async()=>{
  unexpected.push(await page.evaluate(()=>window.__handoverQA.calls.unexpected));
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(unexpected.every(value=>value===0),true);
 });
 await dispose(f);
}
(async()=>{
 assert.equal(version,"2.3.0-preview.110");
 browser=await chromium.launch({headless:true});
 await runTests();
 const report={status:"passed",checks:checks.length,details:checks,buildVersion:version,bridge:"synthetic handover/read bridge; no native updater, real database, central account or operational profile accessed",externalRequests:external.length};
 assert.ok(checks.length>0);
 fs.writeFileSync(path.join(output,"handover-ui-report.json"),JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));
})().catch(async error=>{
 if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:path.join(shots,"handover-failure.png"),fullPage:true}).catch(()=>{});
 fs.writeFileSync(path.join(output,"handover-ui-report.json"),JSON.stringify({status:"failed",checks:checks.length,details:checks,error:error.stack,errors,external},null,2));
 console.error(error);process.exitCode=1;
}).finally(async()=>{await browser?.close();});
