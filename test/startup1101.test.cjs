'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../desktop/store.cjs');
const handover=require('../desktop/handover107.cjs');
const gate=require('../desktop/startup-gate108.cjs');
const A={userId:'startup1101-a',display_name:'Operador A',role:'operator',condos:['CEA']};
const B={userId:'startup1101-b',display_name:'Operador B',role:'operator',condos:['CEA']};
const outgoing='2026-11-21T17:55:00-03:00',arrival='2026-11-21T18:12:00-03:00';
const row=(id,at,extra={})=>({id,protocol:'MOP-'+id,condo:'CEA',subject:'Registro '+id,category:'Operação',description:'Descrição '+id,status:'Pendente',priority:'Normal',created_at:at,updated_at:at,...extra});
function setup(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop-startup1101-')),store=new Store(dir),state=store.read();
 state.items=[
  row(1,'2026-11-21T11:10:00-03:00',{assignee:'  Equipe técnica  ',next_action:'  Confirmar retorno às 20h.  ',action_taken:'  Chamado aberto.  ',deadline:'2026-11-21T21:00:00-03:00'}),
  row(2,'2026-11-20T09:00:00-03:00',{priority:'Urgente',assignee:'Supervisão',next_action:'Contatar prestador e registrar previsão.',action_taken:'Área isolada.',deadline:'2026-11-21T17:00:00-03:00'}),
  row(3,'2026-11-21T12:00:00-03:00',{status:'Resolvido',priority:'Alta',deadline:'2026-11-21T13:00:00-03:00'}),
  row(4,'2026-11-21T18:05:00-03:00'),
  row(5,'2026-11-19T10:00:00-03:00',{status:'Resolvido'}),
  row(6,'2026-11-21T18:01:00-03:00',{condo:'OUTRA',assignee:'Equipe fora do escopo',next_action:'Orientação fora do escopo',priority:'Urgente'}),
  row(7,'2026-11-21T18:02:00-03:00',{deleted_at:'2026-11-21T18:03:00-03:00',priority:'Urgente'})
 ];
 state.nextItem=8;store.write(state);
 const review=handover.snapshot(store,A,new Date(outgoing));
 handover.checkout(store,A,'deliver',{summary:'Conferir chamados e continuidade do plantão.',reviewToken:review.reviewToken,checklist:['pending','deadlines','continuity']},outgoing);
 return {store,cleanup(){store.close();fs.rmSync(dir,{recursive:true,force:true});}};
}
const payload=s=>({shiftId:s.shiftId,deliveryId:s.deliveryId,token:s.token,confirmedIds:s.items.map(x=>x.id),readVersions:Object.fromEntries(s.items.filter(x=>x.critical).map(x=>[x.id,x.version])),note:''});
const snap=store=>gate.snapshot(store,B,new Date(arrival));
function change(store,fn){const state=store.read();fn(state);store.write(state);}
function withStore(fn){const x=setup();try{return fn(x.store);}finally{x.cleanup();}}

test('Startup exposes real continuity details for outgoing, current and critical records',()=>withStore(store=>{
 const s=snap(store),byId=new Map(s.items.map(x=>[x.id,x]));
 assert.deepEqual([...byId.keys()],['MOP-2','MOP-1','MOP-3','MOP-4']);
 assert.equal(s.createdCount,2);assert.equal(s.criticalCount,1);
 const previous=byId.get('MOP-1');
 assert.equal(previous.assignee,'Equipe técnica');assert.equal(previous.nextAction,'Confirmar retorno às 20h.');
 assert.equal(previous.actionTaken,'Chamado aberto.');assert.equal(previous.deadline,'2026-11-21T21:00:00-03:00');
 assert.equal(previous.createdDuringOutgoing,true);assert.equal(previous.createdDuringCurrent,false);assert.equal(previous.overdue,false);
 const critical=byId.get('MOP-2');assert.equal(critical.critical,true);assert.equal(critical.overdue,true);
 assert.equal(critical.assignee,'Supervisão');assert.equal(critical.nextAction,'Contatar prestador e registrar previsão.');
 const current=byId.get('MOP-4');
 assert.equal(current.createdDuringCurrent,true);assert.equal(current.createdDuringOutgoing,false);
 assert.equal(current.assignee,'');assert.equal(current.nextAction,'');assert.equal(current.actionTaken,'');assert.equal(current.deadline,null);assert.equal(current.overdue,false);
 const resolved=byId.get('MOP-3');
 assert.equal(resolved.status,'Concluído');assert.equal(resolved.critical,false);assert.equal(resolved.overdue,false);
}));

test('Hidden and deleted records neither leak continuity data nor invalidate a visible review',()=>withStore(store=>{
 const before=snap(store);
 assert.ok(!JSON.stringify(before).includes('fora do escopo'));
 change(store,state=>{state.items.find(x=>x.id===6).next_action='Mudança invisível';state.items.find(x=>x.id===7).assignee='Oculto';});
 const after=snap(store);
 assert.equal(after.token,before.token);assert.deepEqual(after.items,before.items);
}));

test('Unchanged polling keeps the review token stable despite a later query time',()=>withStore(store=>{
 const a=gate.snapshot(store,B,new Date(arrival)),b=gate.snapshot(store,B,new Date('2026-11-21T18:12:30-03:00'));
 assert.equal(a.token,b.token);assert.deepEqual(a.items,b.items);
}));

test('Material record edits without a new timestamp invalidate confirmation before any receipt write',()=>{
 const edits={assignee:'Outra equipe',next_action:'Nova orientação',action_taken:'Nova providência',deadline:'2026-11-21T20:00:00-03:00',subject:'Assunto revisado',description:'Descrição revisada',category:'Manutenção'};
 for(const [field,value] of Object.entries(edits))withStore(store=>{
  const old=snap(store),version=old.items.find(x=>x.id==='MOP-2').version;
  change(store,state=>{state.items.find(x=>x.id===2)[field]=value;});
  const fresh=snap(store),before=store.read();
  assert.equal(fresh.items.find(x=>x.id==='MOP-2').version,version);
  assert.notEqual(fresh.token,old.token,field);
  assert.throws(()=>gate.receive(store,B,payload(old),new Date(arrival)),/Dados da passagem alterados/);
  assert.deepEqual(store.read(),before,'Stale '+field+' confirmation must not write');
  assert.equal(store.read().handovers[0].receipt_at,undefined);
 });
});

test('Changing delivery summary, sender or delivery time invalidates the same delivery ID',()=>{
 const edits=[
  h=>{h.handover_note='Resumo corrigido para o próximo plantão.';},
  h=>{h.outgoing='Operador remetente corrigido';h.outgoing_identity={...h.outgoing_identity,display_name:h.outgoing};},
  h=>{h.outgoing_identity={...h.outgoing_identity,user_id:'corrected-sender'};},
  h=>{h.at='2026-11-21T17:56:00-03:00';},
  h=>{h.delivered_at='2026-11-21T17:56:00-03:00';}
 ];
 for(const edit of edits)withStore(store=>{
  const old=snap(store);
  change(store,state=>edit(state.handovers[0]));
  const fresh=snap(store),before=store.read();
  assert.equal(fresh.deliveryId,old.deliveryId);assert.notEqual(fresh.token,old.token);
  assert.throws(()=>gate.receive(store,B,payload(old),new Date(arrival)),/Dados da passagem alterados/);
  assert.deepEqual(store.read(),before);
 });
});

test('A newly overdue open record changes the token and requires its current read version',()=>withStore(store=>{
 change(store,state=>{state.items.find(x=>x.id===4).deadline='2026-11-21T18:13:00';state.items.find(x=>x.id===1).deadline='invalid-date';});
 const before=snap(store),later=new Date('2026-11-21T18:14:00-03:00'),after=gate.snapshot(store,B,later);
 assert.equal(before.items.find(x=>x.id==='MOP-4').overdue,false);
 assert.equal(after.items.find(x=>x.id==='MOP-4').overdue,true);assert.equal(after.items.find(x=>x.id==='MOP-4').critical,true);
 assert.equal(after.items.find(x=>x.id==='MOP-1').overdue,false);assert.equal(after.items.find(x=>x.id==='MOP-3').overdue,false);
 assert.notEqual(before.token,after.token);
 assert.throws(()=>gate.receive(store,B,payload(before),later),/alterados/);
 const missingRead=payload(after);delete missingRead.readVersions['MOP-4'];
 assert.throws(()=>gate.receive(store,B,missingRead,later),/críticas/);
 assert.equal(store.read().handovers[0].receipt_at,undefined);
}));

test('Existing receipt payload still requires every visible record and only critical read versions',()=>withStore(store=>{
 const s=snap(store),input=payload(s);
 assert.deepEqual(Object.keys(input.readVersions),['MOP-2']);
 assert.throws(()=>gate.receive(store,B,{...input,confirmedIds:input.confirmedIds.filter(id=>id!=='MOP-3')},new Date(arrival)),/todos os registros/);
 assert.throws(()=>gate.receive(store,B,{...input,confirmedIds:[input.confirmedIds[0],...input.confirmedIds.slice(0,-1)]},new Date(arrival)),/todos os registros/);
 assert.throws(()=>gate.receive(store,B,{...input,readVersions:{}},new Date(arrival)),/críticas/);
 const result=gate.receive(store,B,input,new Date(arrival));
 assert.equal(result.accepted,true);assert.equal(snap(store).accepted,true);
 assert.equal(store.read().handovers[0].receipt_user_id,B.userId);
 assert.equal(gate.receive(store,B,input,new Date(arrival)).alreadyAccepted,true);
}));

test('Permissions, self-receipt and bootstrap full-review requirements are preserved',()=>withStore(store=>{
 const s=snap(store);
 assert.throws(()=>gate.receive(store,{...B,role:'viewer'},payload(s),new Date(arrival)),/permissão/);
 const own=gate.snapshot(store,A,new Date(arrival));assert.equal(own.selfDelivery,true);
 assert.throws(()=>gate.receive(store,A,payload(own),new Date(arrival)),/própria entrega/);
 change(store,state=>{state.handovers=[];state.nextHandover=1;});
 const fresh=snap(store);assert.equal(fresh.canBootstrap,true);assert.equal(fresh.deliveryId,null);
 assert.throws(()=>gate.receive(store,B,{...payload(fresh),bootstrap:true,confirmedIds:[]},new Date(arrival)),/todos os registros/);
 assert.throws(()=>gate.receive(store,B,{...payload(fresh),bootstrap:true,readVersions:{}},new Date(arrival)),/crítica/);
 assert.equal(gate.receive(store,B,{...payload(fresh),bootstrap:true},new Date(arrival)).accepted,true);
 assert.equal(store.read().handovers[0].receipt_override,false);
 assert.equal(store.read().handovers[0].receipt_user_id,B.userId);
}));

test('Added snapshot fields do not alter operational records or add a database schema',()=>withStore(store=>{
 const s=snap(store),items=store.read().items;
 const schema=()=>store.db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
 const before=schema();
 snap(store);gate.receive(store,B,payload(s),new Date(arrival));
 assert.deepEqual(schema(),before);
 assert.deepEqual(store.read().items,items);
}));
