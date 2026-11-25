'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../desktop/store.cjs');
const handover=require('../desktop/handover107.cjs');
const gate=require('../desktop/startup-gate108.cjs');
const A={userId:'op-a',display_name:'Operador A',role:'operator',condos:['CEA']};
const B={userId:'op-b',display_name:'Operador B',role:'operator',condos:['CEA']};
const C={userId:'op-c',display_name:'Operador C',role:'operator',condos:['OUTRA']};
const start='2026-11-21T17:55:00-03:00',arrival='2026-11-21T18:12:00-03:00';
const create=(id,at,opts={})=>({id,protocol:'MOP-'+id,condo:'CEA',subject:'Ocorrência '+id,description:'Descrição '+id,status:'Pendente',priority:'Normal',created_at:at,updated_at:at,...opts});
function setup(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mopgate108-'));const store=new Store(dir);const state=store.read();
 state.items=[create(1,'2026-11-21T11:10:00-03:00'),create(2,'2026-11-20T09:10:00-03:00',{priority:'Urgente'}),create(3,'2026-11-20T08:00:00-03:00',{status:'Resolvido'}),create(4,'2026-11-21T12:10:00-03:00',{status:'Resolvido'})];state.nextItem=5;store.write(state);
 const token=handover.snapshot(store,A,new Date(start)).reviewToken;
 const delivery=handover.checkout(store,A,'deliver',{summary:'Receber registros e acompanhar pendências.',reviewToken:token,checklist:['pending','deadlines','continuity']},start);
 return {store,delivery,cleanup:()=>{store.close();fs.rmSync(dir,{recursive:true,force:true})}}
}
function payload(snapshot){return {shiftId:snapshot.shiftId,deliveryId:snapshot.deliveryId,token:snapshot.token,confirmedIds:snapshot.items.map(x=>x.id),readVersions:Object.fromEntries(snapshot.items.filter(x=>x.critical).map(x=>[x.id,x.version])),note:'Sem ressalvas'}}
test('Gate includes all created records, including resolved, plus old critical pending',()=>{const {store,cleanup}=setup();try{const s=gate.snapshot(store,B,new Date(arrival));assert.equal(s.createdCount,2);assert.equal(s.criticalCount,1);assert.deepEqual(s.items.map(x=>x.id),['MOP-2','MOP-1','MOP-4']);assert.equal(s.accepted,false);assert.equal(s.deliveryId,1);assert.equal(gate.snapshot(store,A,new Date(arrival)).selfDelivery,true)}finally{cleanup()}});
test('Single receipt commits the handover and unlocks; duplicate is idempotent',()=>{const {store,cleanup}=setup();try{const s=gate.snapshot(store,B,new Date(arrival));const result=gate.receive(store,B,payload(s),new Date(arrival));assert.equal(result.accepted,true);assert.equal(gate.snapshot(store,B,new Date(arrival)).accepted,true);assert.equal(store.read().handovers.length,1);const again=gate.receive(store,B,payload(s),new Date(arrival));assert.equal(again.alreadyAccepted,true);assert.equal(store.read().handovers.length,1);const h=store.read().handovers[0];assert.equal(h.receipt_user_id,B.userId);assert.equal(h.receipt_slot,s.shiftId);assert.equal(h.read_confirmations.length,1)}finally{cleanup()}});
test('Partial review, stale token and same sender are rejected',()=>{const {store,cleanup}=setup();try{const s=gate.snapshot(store,B,new Date(arrival));assert.throws(()=>gate.receive(store,B,{...payload(s),confirmedIds:['MOP-1']},new Date(arrival)),/todos os registros/);assert.throws(()=>gate.receive(store,B,{...payload(s),token:'obsolete'},new Date(arrival)),/alterados/);assert.throws(()=>gate.receive(store,A,payload(gate.snapshot(store,A,new Date(arrival))),new Date(arrival)),/própria entrega/);assert.equal(store.read().handovers[0].receipt_at,undefined);assert.equal(gate.snapshot(store,B,new Date(arrival)).accepted,false)}finally{cleanup()}});
test('No delivered handover and foreign condominium cannot unlock',()=>{const {store,cleanup}=setup();try{assert.equal(gate.snapshot(store,C,new Date(arrival)).accepted,false);assert.throws(()=>gate.receive(store,C,payload(gate.snapshot(store,C,new Date(arrival))),new Date(arrival)),/Nenhuma entrega/)}finally{cleanup()}});
test('Interrupted bookkeeping can be restored without a second handover receipt',()=>{const {store,cleanup}=setup();try{const s=gate.snapshot(store,B,new Date(arrival));handover.checkout(store,B,'receive',{deliveryId:s.deliveryId,readVersions:payload(s).readVersions,receiptSlot:s.shiftId},arrival);assert.equal(gate.snapshot(store,B,new Date(arrival)).accepted,true);assert.equal(gate.receive(store,B,payload(s),new Date(arrival)).alreadyAccepted,true);assert.equal(gate.snapshot(store,B,new Date(arrival)).accepted,true)}finally{cleanup()}});
test('Supervisor can initialize a shift only with audited justification and full review',()=>{const {store,cleanup}=setup();try{
 const state=store.read();state.handovers=[];state.nextHandover=1;store.write(state);
 const sup={userId:'super-1',display_name:'Supervisor',role:'supervisor',condos:['CEA']};
 const snap=gate.snapshot(store,sup,new Date(arrival));assert.equal(snap.canBootstrap,true);assert.equal(snap.accepted,false);
 
 const result=gate.receive(store,sup,{...payload(snap),bootstrap:true,note:'Início excepcional, ausência de entrega anterior.'},new Date(arrival));
 assert.equal(result.bootstrap,true);assert.equal(gate.snapshot(store,sup,new Date(arrival)).accepted,true);
 assert.equal(store.read().handovers[0].receipt_override,false);
 assert.equal(store.read().handovers[0].receipt_user_id,sup.userId);
 }finally{cleanup()}
});

test('Operator is not blocked when no prior delivery exists, with mandatory audited no-delivery acknowledgment',()=>{const {store,cleanup}=setup();try{
 const state=store.read();state.handovers=[];state.nextHandover=1;store.write(state);
 const snap=gate.snapshot(store,B,new Date(arrival));assert.equal(snap.canBootstrap,true);assert.equal(snap.deliveryId,null);
 
 assert.throws(()=>gate.receive(store,B,{...payload(snap),bootstrap:true,note:'Sem entrega anterior no posto.',confirmedIds:[]},new Date(arrival)),/todos os registros/);
 const accepted=gate.receive(store,B,{...payload(snap),bootstrap:true,note:'Não houve entrega formal do turno anterior.'},new Date(arrival));
 assert.equal(accepted.accepted,true);assert.equal(gate.snapshot(store,B,new Date(arrival)).accepted,true);
 const record=store.read().handovers[0];assert.equal(record.receipt_user_id,B.userId);assert.equal(record.receipt_override,false);assert.equal(record.receipt_note,'Início sem entrega anterior registrada; conferência operacional confirmada.');
 assert.equal(gate.receive(store,B,payload(snap),new Date(arrival)).alreadyAccepted,true);
 }finally{cleanup()}
});
test('Gate lists old non-critical unresolved occurrences and current-shift records, with no duplicate',()=>{const {store,cleanup}=setup();try{
 const state=store.read();state.items.push(create(5,'2026-11-15T09:00:00-03:00',{priority:'Normal',status:'Em andamento'}));state.items.push(create(6,'2026-11-21T18:05:00-03:00',{priority:'Normal'}));state.nextItem=7;store.write(state);
 const snap=gate.snapshot(store,B,new Date(arrival));assert.ok(snap.items.some(x=>x.id==='MOP-5'));assert.ok(snap.items.some(x=>x.id==='MOP-6'));
 assert.equal(new Set(snap.items.map(x=>x.id)).size,snap.items.length);
 }finally{cleanup()}
});

test('Receiving without previous delivery records an audit row without asking for a written note',()=>{const {store,cleanup}=setup();try{const state=store.read();state.handovers=[];state.nextHandover=1;store.write(state);const snap=gate.snapshot(store,B,new Date(arrival));const accepted=gate.receive(store,B,{...payload(snap),bootstrap:true,note:''},new Date(arrival));assert.equal(accepted.accepted,true);const rows=gate.history(store,{...B,role:'supervisor'});assert.equal(rows.length,1);assert.equal(rows[0].kind,'Início sem entrega anterior');assert.equal(rows[0].user_id,B.userId);assert.equal(Date.parse(rows[0].received_at),Date.parse(arrival));assert.equal(rows[0].note,'Início sem entrega anterior registrada; conferência operacional confirmada.');assert.throws(()=>gate.history(store,B),/restrito/)}finally{cleanup()}});
test('Supervisor audit includes normal receipt and correct outgoing operator',()=>{const {store,cleanup}=setup();try{const s=gate.snapshot(store,B,new Date(arrival));gate.receive(store,B,payload(s),new Date(arrival));const rows=gate.history(store,{...B,role:'supervisor'});assert.equal(rows.length,1);assert.equal(rows[0].kind,'Recebimento de turno');assert.equal(rows[0].operator,'Operador B');assert.equal(rows[0].outgoing,'Operador A')}finally{cleanup()}});
test('The startup window hides record protocol and has no free-form explanation field',()=>{const f=require('node:fs'),pth=require('node:path');const ui=f.readFileSync(pth.join(__dirname,'../ui-next/src/StartupReceipt108.tsx'),'utf8');assert.ok(ui.includes('mop108-record-location'));assert.ok(ui.includes('mop108-record-description'));assert.ok(!ui.includes('<textarea'));assert.ok(!ui.includes('{item.id} ·'))});

test('Previously accepted same shift must show new delivery from a different operator',()=>{const {store,cleanup}=setup();try{
 const state=store.read();state.handovers=[];state.nextHandover=1;store.write(state);
 const at=new Date(arrival),first=gate.snapshot(store,B,at);
 gate.receive(store,B,{...payload(first),bootstrap:true},at);
 assert.equal(gate.snapshot(store,B,at).accepted,true);
 const deliveryTime='2026-11-21T18:15:00-03:00',review=handover.snapshot(store,A,new Date(deliveryTime));
 const delivered=handover.checkout(store,A,'deliver',{summary:'Passagem registrada após início anterior.',reviewToken:review.reviewToken,checklist:['pending','deadlines','continuity']},deliveryTime);
 const next=gate.snapshot(store,B,new Date('2026-11-21T18:20:00-03:00'));
 assert.equal(next.accepted,false);assert.equal(next.deliveryId,delivered.id);
 assert.equal(gate.receive(store,B,payload(next),new Date('2026-11-21T18:20:00-03:00')).accepted,true);
 assert.equal(gate.snapshot(store,B,new Date('2026-11-21T18:20:00-03:00')).accepted,true);
 }finally{cleanup()}});
test('Zero-open-incident delivery is visible to next operator in shared central scope',()=>{const {store,cleanup}=setup();try{
 const state=store.read();state.items=[];state.handovers=[];state.nextHandover=1;store.write(state);
 const time=new Date(start),s=handover.snapshot(store,A,time);
 const delivered=handover.checkout(store,A,'deliver',{summary:'Plantão sem ocorrências pendentes.',reviewToken:s.reviewToken,checklist:['pending','deadlines','continuity']},start);
 const incoming=gate.snapshot(store,B,new Date(arrival));assert.equal(incoming.deliveryId,delivered.id);assert.equal(incoming.canBootstrap,false);assert.equal(incoming.items.length,0);
 assert.equal(gate.receive(store,B,payload(incoming),new Date(arrival)).accepted,true);
 }finally{cleanup()}});
