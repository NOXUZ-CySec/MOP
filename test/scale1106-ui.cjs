"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {chromium,expect}=require(process.env.MOP_PLAYWRIGHT_MODULE||"@playwright/test");
const root=path.resolve(__dirname,".."),output=path.join(root,"test-results/release1106"),shots=path.join(output,"screenshots");
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
  const q=window.__handoverQA={user:"alpha",role:"admin",failSnapshot:false,failAction:null,holdSnapshots:false,holdCommand:false,online:true,
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
  q.tasks=[{id:"a",title:"Inspe\u00e7\u00e3o de c\u00e2meras",period:"Diurno",recurrence:"daily",reminder_time:"08:00"},{id:"b",title:"Ronda de portaria",period:"Todos",recurrence:"daily",reminder_time:"10:00"},{id:"c",title:"Rotina noturna",period:"Noturno",recurrence:"daily"},{id:"d",title:"Atividade futura",period:"Todos",recurrence:"date",scheduled_date:"2026-12-01"}];q.runs=[];q.actions=[];q.failList=false;const account=()=>({authenticated:true,role:q.role,userId:"qa-"+q.user,username:q.user,display_name:"Operador "+q.user,mode:q.online?"online":"offline",condos:["Unidade QA"]});
  const records=()=>({items:q.snapshot.items.map((item,index)=>({id:101+index,protocol:item.id,subject:item.title,description:item.description,category:item.category,status:item.status,priority:item.sourcePriority,created_at:"2026-11-25T11:00:00.000Z",updated_at:"2026-11-25T14:00:00.000Z",created_by:"Operador "+q.user,created_identity:{user_id:item.canEditContinuity?"qa-"+q.user:"qa-other"},condo:item.condo,assignee:item.assignee,next_action:item.nextAction,action_taken:item.actionTaken,deadline:item.deadline}))});
  window.mopDesktop={
 schedule68:async(action,input={})=>{q.actions.push({action,input});if(action==="load"){if(q.failList)throw Error("Consulta QA indisponivel");return {scope:"local",rows:q.scaleRows||[],requests:[]}}if(action==="pending")return [];if(action==="batch"){q.scaleRows=input.entries;return {saved:input.entries.length}}throw Error("Unexpected scale action")},
 checklist68:async(action,input={})=>{q.actions.push({action,input});if(action==="list"){if(q.failList)throw Error("Consulta QA indisponivel");return {tasks:q.tasks,runs:q.runs,date:"2026-11-25",scope:"central"}}if(action==="complete"){q.runs.push({task_id:input.id});return {completed:true}}if(action==="create"){q.tasks.push({...input,id:"new"});return {id:"new"}}if(action==="edit"){Object.assign(q.tasks.find(t=>t.id===input.id),input);return {updated:true}}if(action==="disable"){q.tasks=q.tasks.filter(t=>t.id!==input.id);return {disabled:true}}throw Error("Unexpected action")},reminderTest97:async()=>true,
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
 await expect(nav).toBeVisible();await nav.getByRole("button",{name:"Escala",exact:true}).click();
 const panel=page.locator(".scale1106");
 await expect(panel).toBeVisible();
 if(!options.failSnapshot)await expect(panel.getByRole("heading",{name:"Escala de Trabalho",exact:true})).toBeVisible();
 return{context,page,nav,panel};
}


async function main(){browser=await chromium.launch();const f=await fixture();const {page,panel}=f;const days=panel.locator('[data-scale-date]');
await check('November calendar and monthly totals',async()=>{await expect(days).toHaveCount(30);await expect(panel.locator('.scale1106-stat strong')).toHaveText(['15','15','0','0']);await expect(panel.locator('[aria-current=date]')).toHaveAttribute('data-scale-date','2026-11-25')});
await check('Month navigation and today shortcut',async()=>{await panel.getByRole('button',{name:'Pr\u00f3ximo m\u00eas'}).click();await expect(days).toHaveCount(31);await panel.getByRole('button',{name:'Hoje',exact:true}).click();await expect(days).toHaveCount(30)});
await check('Keyboard selection, vacation draft, undo and save',async()=>{const day=days.first();await day.focus();await page.keyboard.press('Enter');await expect(panel.getByRole('dialog',{name:'Alterar classifica\u00e7\u00e3o da escala'})).toBeVisible();await panel.getByRole('button',{name:'F\u00e9rias',exact:true}).click();await expect(day).toHaveClass(/vacation/);await expect(panel.locator('.scale1106-stat.vacation strong')).toHaveText('1');await panel.getByRole('button',{name:'Desfazer',exact:true}).click();await expect(day).not.toHaveClass(/vacation/);await day.focus();await page.keyboard.press('Enter');await panel.getByRole('button',{name:'F\u00e9rias',exact:true}).click();await panel.getByRole('button',{name:'Salvar escala',exact:true}).click();await panel.getByRole('button',{name:'Confirmar',exact:true}).click();await expect(day).toHaveClass(/vacation/);await expect(panel.getByRole('button',{name:'Salvar escala',exact:true})).toBeDisabled()});
await check('Failed consultation blocks editing and retry recovers',async()=>{await page.evaluate(()=>{window.__handoverQA.failList=true;window.__handoverQA.sync()});await expect(panel.getByRole('button',{name:'Tentar novamente'})).toBeVisible();await expect(panel.getByRole('button',{name:'Salvar escala'})).toBeDisabled();await page.evaluate(()=>window.__handoverQA.failList=false);await panel.getByRole('button',{name:'Tentar novamente'}).click();await expect(panel.locator('.scale1106-stat.vacation strong')).toHaveText('1')});
await check('Compact layout without horizontal overflow',async()=>{await page.setViewportSize({width:1024,height:640});assert.ok(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+2));await page.screenshot({path:path.join(shots,'scale-compact.png')});assert.deepEqual(errors,[]);assert.deepEqual(external,[])});await f.context.close();const op=await fixture({role:'operator'});await check('Operator can consult but cannot manage scale',async()=>{await expect(op.panel.locator('[data-scale-date]')).toHaveCount(30);await expect(op.panel.getByRole('button',{name:'Salvar escala'})).toHaveCount(0);await expect(op.panel.getByRole('button',{name:'Solicitar troca'})).toBeVisible()});await op.context.close();fs.writeFileSync(path.join(output,'scale-ui-report.json'),JSON.stringify({status:'passed',version,checks:checks.length,details:checks},null,2));}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close()});
