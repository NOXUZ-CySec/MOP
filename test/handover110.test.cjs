'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../desktop/store.cjs');
const {Intelligence}=require('../desktop/intelligence.cjs');
const {SyncStore}=require('../desktop/sync-store.cjs');
const handover=require('../desktop/handover107.cjs'),H=require('../src/handover-automation.js'),gate=require('../desktop/startup-gate108.cjs');
const at='2026-11-25T17:50:00-03:00',now=new Date(at),later='2026-11-25T18:05:00-03:00';
const A={userId:'test-author-110',display_name:'Autor de teste',role:'operator',condos:['CEA']};
const B={userId:'test-receiver-110',display_name:'Recebedor de teste',role:'operator',condos:['CEA']};
const C={userId:'test-foreign-110',display_name:'Outro escopo',role:'admin',condos:['OUTRA']};
const checklist=['pending','deadlines','continuity'];
const record=(id,extra={})=>({id,protocol:'MOP-20261125-'+String(id).padStart(12,'0'),condo:'CEA',subject:'Pendência '+id,description:'Conferir equipamento',status:'Pendente',priority:'Normal',created_at:at,updated_at:at,created_identity:{user_id:A.userId,display_name:A.display_name},created_by:A.display_name,...extra});
function fixture(t,rows=[{}]){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mop-handover110-')),store=new Store(directory),state=store.read();
 state.items=rows.map((row,index)=>record(index+1,row));state.nextItem=state.items.length+1;store.write(state);
 store.intelligence=new Intelligence(store);
 t.after(()=>{store.close();fs.rmSync(directory,{recursive:true,force:true})});
 return store;
}
const payload=(item,extra={})=>({protocol:item.protocol,readVersion:H.version(item),assignee:'Equipe técnica',nextAction:'Conferir retorno às 19h',...extra});
const deliver=(store,user=A,time=at)=>{const s=handover.snapshot(store,user,new Date(time));return handover.checkout(store,user,'deliver',{summary:'Resumo operacional para continuidade.',reviewToken:s.reviewToken,checklist},time)};
test('Snapshot exposes real missing fields, metadata and scope-aware continuity counts',t=>{
 const store=fixture(t,[{assignee:'',next_action:'',deadline:'2026-11-25T18:30:00-03:00',action_taken:'Técnico acionado',priority:'Alta'},{assignee:'Equipe B',next_action:'Conferir painel',condo:'OUTRA'}]);
 const s=handover.snapshot(store,A,now),item=s.items[0];
 assert.equal(s.items.length,1);assert.equal(item.assignee,'');assert.equal(item.nextAction,'');
 assert.equal(item.missingAssignee,true);assert.equal(item.missingNextAction,true);assert.equal(item.condo,'CEA');assert.equal(item.sourcePriority,'Alta');
 assert.equal(item.actionTaken,'Técnico acionado');assert.equal(item.deadline,'2026-11-25T18:30:00-03:00');assert.equal(item.dueSoon,true);assert.equal(item.overdue,false);
 assert.equal(item.readVersion,at);assert.equal(item.updatedAt,at);assert.equal(item.canEditContinuity,true);
 assert.equal(s.counts.missingAssignee,1);assert.equal(s.counts.missingNextAction,1);assert.equal(s.counts.continuityReady,0);assert.equal(s.counts.open,1);
 assert.equal(s.shiftId,'2026-11-25/Diurno');assert.equal(s.updatedAt,now.toISOString());assert.equal(s.receiptNote,'');assert.equal(s.deliveredAt,null);assert.deepEqual(s.deliveredItems,[]);
});
test('Handover and startup share critical review policy including high, attention and overdue',t=>{
 const store=fixture(t,[{priority:'Urgente'},{priority:'Alta'},{priority:'Crítica'},{priority:'Atenção'},{deadline:'2026-11-25T17:49:00-03:00'},{priority:'Normal',deadline:'2026-11-25T18:00:00-03:00'}]);
 const s=handover.snapshot(store,A,now),startup=gate.gather(store.read(),A,now);
 assert.equal(s.counts.critical,5);assert.equal(startup.items.filter(x=>x.critical).length,5);
 assert.deepEqual(s.items.filter(x=>x.critical).map(x=>x.id).sort(),startup.items.filter(x=>x.critical).map(x=>x.id).sort());
 assert.equal(H.version(store.read().items[0]),at);
});
test('Missing continuity fields remain visible without adding a delivery block',t=>{
 const store=fixture(t),s=handover.snapshot(store,A,now);
 assert.equal(s.counts.continuityReady,0);
 assert.throws(()=>handover.checkout(store,A,'deliver',{summary:'Resumo',reviewToken:s.reviewToken,checklist:[]},at),/três itens/);
 const saved=deliver(store);assert.equal(saved.action,'deliver');assert.equal(store.read().handovers.length,1);
});
test('Delivered items stay frozen while live changes show updated, resolved, unavailable and added',t=>{
 const store=fixture(t,[{assignee:'Equipe inicial',next_action:'Ação entregue'},{},{ }]);deliver(store);
 const state=store.read();state.items[0].next_action='Orientação nova';state.items[0].updated_at=later;
 state.items[1].status='Resolvido';state.items[1].updated_at=later;state.items[2].deleted_at=later;
 state.items.push(record(4,{created_at:later,updated_at:later}));state.nextItem=5;store.write(state);
 const s=handover.snapshot(store,B,new Date(later));
 assert.equal(s.stage,'receipt');assert.equal(s.deliveredItems.length,3);assert.equal(s.items.length,2);
 assert.equal(s.deliveredItems[0].nextAction,'Ação entregue');assert.equal(s.items.find(x=>x.id.endsWith('000001')).nextAction,'Orientação nova');
 assert.ok(s.deliveredItems.every(x=>x.canEditContinuity===false));
 assert.deepEqual(s.changes.map(x=>x.kind).sort(),['added','resolved','unavailable','updated'].sort());assert.equal(s.counts.changedSinceDelivery,4);
 assert.equal(s.deliveredAt,at);assert.equal(s.deliveredShift.type,'Diurno');assert.equal(s.shift,'Noturno');
});
test('Continuity edits preserve record fields and hidden scope, add history and auditable actor',t=>{
 const store=fixture(t,[{assignee:'Equipe anterior',assignee_user_id:'old-user',next_action:'Ação anterior',action_taken:'Ação preservada',reference:'REF-110',custom:{preserve:true}},{condo:'OUTRA',subject:'Registro oculto'}]);
 const before=store.read(),first=before.items[0],hidden=JSON.stringify(before.items[1]);
 const result=handover.checkout(store,A,'assignPending',payload(first),at),after=store.read(),updated=after.items[0];
 assert.equal(result.changed,true);assert.equal(result.action,'assignPending');assert.equal(updated.assignee,'Equipe técnica');assert.equal(updated.next_action,'Conferir retorno às 19h');
 assert.equal(updated.assignee_user_id,undefined);assert.equal(updated.action_taken,first.action_taken);assert.equal(updated.reference,first.reference);assert.deepEqual(updated.custom,first.custom);
 assert.deepEqual(updated.created_identity,first.created_identity);assert.equal(updated.updated_identity.user_id,A.userId);assert.equal(JSON.stringify(after.items[1]),hidden);
 assert.ok(Date.parse(result.readVersion)>Date.parse(at));assert.equal(after.events.length,1);assert.equal(after.events[0].author.user_id,A.userId);assert.equal(after.events[0].kind,'Continuidade do turno');
 const audit=store.intelligence.audit({...A,role:'supervisor'}).rows.find(row=>row.action==='record.updated');
 assert.equal(audit.actor.id,A.userId);assert.equal(audit.detail.changed.assignee.after,'Equipe técnica');
});
test('Continuity permissions preserve author or supervision policy and reject foreign scope',t=>{
 const store=fixture(t),initial=store.read(),input=payload(initial.items[0]);
 assert.equal(handover.snapshot(store,B,now).items[0].canEditContinuity,false);
 for(const user of [B,{...A,role:'viewer'},C]){
  assert.throws(()=>handover.checkout(store,user,'assignPending',input,later),/autor|permissão|acesso|indisponível/);
  assert.deepEqual(store.read(),initial);
 }
 const supervisor={...B,role:'supervisor'};
 assert.equal(handover.snapshot(store,supervisor,now).items[0].canEditContinuity,true);
 assert.equal(handover.checkout(store,supervisor,'assignPending',input,later).changed,true);
});
test('Stale versions and invalid continuity fields never alter records',t=>{
 const store=fixture(t),before=store.read(),input=payload(before.items[0]);
 for(const extra of [{readVersion:'old'},{readVersion:''},{assignee:'x'.repeat(161)},{nextAction:'x'.repeat(1001)},{assignee:{}},{nextAction:null}]){
  assert.throws(()=>handover.checkout(store,A,'assignPending',{...input,...extra},later));
  assert.deepEqual(store.read(),before);
 }
});
test('No-op continuity save is idempotent and explicit clearing remains possible',t=>{
 const store=fixture(t,[{assignee:'Equipe técnica',next_action:'Conferir retorno às 19h'}]),item=store.read().items[0];
 const same=handover.checkout(store,A,'assignPending',payload(item),later);
 assert.equal(same.changed,false);assert.equal(store.read().events.length,0);assert.equal(H.version(store.read().items[0]),at);
 const clear=handover.checkout(store,A,'assignPending',payload(item,{assignee:'',nextAction:''}),later);
 assert.equal(clear.changed,true);const s=handover.snapshot(store,A,new Date(later));assert.equal(s.counts.missingAssignee,1);assert.equal(s.counts.missingNextAction,1);
});
test('Closed and removed records cannot be changed by continuity action',t=>{
 const store=fixture(t,[{status:'Resolvido'},{deleted_at:at}]),before=store.read();
 for(const row of before.items)assert.throws(()=>handover.checkout(store,{...A,role:'admin'},'assignPending',payload(row),later),/indisponível/);
 assert.deepEqual(store.read(),before);
});
test('Optimistic locking advances even for same-millisecond saves and rejects stale overwrite',t=>{
 const store=fixture(t),item=store.read().items[0],first=handover.checkout(store,A,'assignPending',payload(item),at);
 assert.notEqual(first.readVersion,H.version(item));
 assert.throws(()=>handover.checkout(store,A,'assignPending',payload(item,{nextAction:'Sobrescrever'}),at),/alterada/);
 assert.equal(store.read().items[0].next_action,'Conferir retorno às 19h');assert.equal(store.read().events.length,1);
});
test('Material content invalidates delivery review even if the record timestamp was reused',t=>{
 const store=fixture(t),oldToken=handover.snapshot(store,A,now).reviewToken,fields=['assignee','next_action','action_taken','subject','description'];
 for(const field of fields){
  const state=store.read();state.items[0][field]='Alteração em '+field;store.write(state);
  assert.notEqual(H.token(store.read(),A),oldToken);
  assert.throws(()=>handover.checkout(store,A,'deliver',{summary:'Resumo antigo',checklist,reviewToken:oldToken},at),/alteradas/);
 }
 assert.equal(store.read().handovers.length,0);
});
test('Receipt records all critical confirmations and the actual receiving audit actor',t=>{
 const store=fixture(t,[{priority:'Alta'},{priority:'Atenção'},{priority:'Crítica'}]),saved=deliver(store);
 const input={deliveryId:saved.id,receiptNote:'Continuidade conferida.',readVersions:Object.fromEntries(store.read().items.map(x=>[x.protocol,H.version(x)]))};
 assert.throws(()=>handover.checkout(store,B,'receive',{...input,readVersions:{}},later),/versão atual/);
 const result=handover.checkout(store,B,'receive',input,later),received=store.read().handovers[0];
 assert.equal(result.action,'receive');assert.equal(received.read_confirmations.length,3);assert.equal(received.incoming_identity.user_id,B.userId);
 const audit=store.intelligence.audit({...B,role:'supervisor'}).rows.find(row=>row.action==='shift.received');
 assert.equal(audit.actor.id,B.userId);
});
test('Continuity changes queue through existing sync shapes without changing delivered snapshot',t=>{
 const store=fixture(t),sync=new SyncStore(store);sync.bind('synthetic-handover110');
 const delivered=deliver(store),before=store.read(),frozen=JSON.stringify(before.handovers[0].snapshot),wire=JSON.parse(sync.map('handovers',delivered.id).payload);
 handover.checkout(store,A,'assignPending',payload(before.items[0]),later);
 const after=store.read();assert.equal(JSON.stringify(after.handovers[0].snapshot),frozen);
 assert.deepEqual(JSON.parse(sync.map('handovers',delivered.id).payload),wire);
 assert.equal(JSON.parse(sync.map('items',1).payload).next_action,'Conferir retorno às 19h');
 assert.equal(JSON.parse(sync.map('events',1).payload).kind,'Continuidade do turno');assert.ok(sync.status().pending>=3);
});
test('Audit failure rolls back the entire continuity record and history write',t=>{
 const store=fixture(t),before=store.read(),auditCount=store.db.prepare('SELECT COUNT(*) AS count FROM intelligence_audit').get().count;
 const original=store.intelligence.changes;
 store.intelligence.changes=function(){throw Error('Synthetic audit failure')};
 try{assert.throws(()=>handover.checkout(store,A,'assignPending',payload(before.items[0]),later),/Synthetic audit failure/)}
 finally{store.intelligence.changes=original}
 assert.deepEqual(store.read(),before);assert.equal(store.db.prepare('SELECT COUNT(*) AS count FROM intelligence_audit').get().count,auditCount);
});
