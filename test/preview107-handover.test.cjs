'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../desktop/store.cjs');
const {checkout,snapshot}=require('../desktop/handover107.cjs');
const H=require('../src/handover-automation.js');
const A={userId:'operator-a',display_name:'Operador A',role:'operator',condos:['CEA']},B={userId:'operator-b',display_name:'Operador B',role:'operator',condos:['CEA']},C={userId:'operator-c',display_name:'Operador C',role:'operator',condos:['OUTRA']};
const checklist=['pending','deadlines','continuity'];
function setup(rows=[]){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop107-'));const store=new Store(dir);const state=store.read(),now=new Date().toISOString();state.items=rows.map((r,i)=>({id:i+1,protocol:'MOP-TEST-'+(i+1),condo:'CEA',subject:'Equipamento '+i,description:'Ocorrência operacional',status:'Pendente',priority:'Normal',created_at:now,updated_at:now,...r}));state.nextItem=state.items.length+1;store.write(state);return {store,cleanup:()=>{store.close();fs.rmSync(dir,{recursive:true,force:true})}}}
test('two distinct accounts deliver and receive with a traceable identity',()=>{
 const {store,cleanup}=setup([{priority:'Urgente'}]);try{
 const before=snapshot(store,A);assert.equal(before.stage,'delivery');assert.equal(before.items.length,1);assert.equal(before.items[0].critical,true);
 const delivery=checkout(store,A,'deliver',{summary:'Falha de comunicação. Técnico acionado.',reviewToken:before.reviewToken,checklist});
 assert.equal(snapshot(store,A).stage,'awaiting-receipt');
 assert.equal(snapshot(store,B).stage,'receipt');
 assert.equal(snapshot(store,B).deliveryId,delivery.id);
 assert.throws(()=>checkout(store,A,'receive',{deliveryId:delivery.id,readVersions:{'MOP-TEST-1':before.items[0].readVersion}}),/mesmo usuário/);
 const received=checkout(store,B,'receive',{deliveryId:delivery.id,receiptNote:'Técnico confirmado para próximo turno.',readVersions:{'MOP-TEST-1':before.items[0].readVersion}});
 assert.equal(received.action,'receive');
 const h=store.read().handovers.find(x=>x.id===delivery.id);assert.equal(h.outgoing_identity.user_id,A.userId);assert.equal(h.incoming_identity.user_id,B.userId);assert.equal(h.read_confirmations[0].protocol,'MOP-TEST-1');assert.equal(snapshot(store,B).stage,'delivery');
 assert.throws(()=>checkout(store,C,'receive',{deliveryId:delivery.id,readVersions:{}}),/indisponível|recebida/);
 }finally{cleanup()}
});
test('delivery validates mandatory checklist and rejects stale pending revision',()=>{const {store,cleanup}=setup([{}]);try{const old=snapshot(store,A);assert.throws(()=>checkout(store,A,'deliver',{summary:'x'.repeat(1001),reviewToken:old.reviewToken,checklist}),/esumo/);assert.throws(()=>checkout(store,A,'deliver',{summary:'Resumo',reviewToken:old.reviewToken,checklist:['pending']}),/três itens/);const st=store.read();st.items[0].priority='Urgente';store.write(st);assert.throws(()=>checkout(store,A,'deliver',{summary:'Resumo',reviewToken:old.reviewToken,checklist}),/alteradas/);assert.equal(store.read().handovers.length,0)}finally{cleanup()}});
test('no duplicate active delivery, no double receipt, critical revision must match',()=>{const {store,cleanup}=setup([{priority:'Urgente'}]);try{const s=snapshot(store,A);const d=checkout(store,A,'deliver',{summary:'Resumo operacional',reviewToken:s.reviewToken,checklist});assert.throws(()=>checkout(store,A,'deliver',{summary:'Outra entrega',reviewToken:s.reviewToken,checklist}),/pendente/);assert.throws(()=>checkout(store,B,'receive',{deliveryId:d.id,readVersions:{'MOP-TEST-1':'obsoleta'}}),/versão atual/);assert.equal(store.read().handovers[0].receipt_at,undefined);checkout(store,B,'receive',{deliveryId:d.id,readVersions:{'MOP-TEST-1':s.items[0].readVersion}});assert.throws(()=>checkout(store,B,'receive',{deliveryId:d.id,readVersions:{}}),/indisponível|recebida/)}finally{cleanup()}});
test('record status and responsible next step are visible to next operator',()=>{const {store,cleanup}=setup([{status:'Em andamento',next_action:'Verificar comunicação às 18h',assignee:'Equipe técnica'}]);try{const s=snapshot(store,A);assert.equal(s.items[0].status,'Em andamento');assert.equal(s.items[0].nextAction,'Verificar comunicação às 18h');checkout(store,A,'deliver',{summary:'Pendente de equipe técnica',reviewToken:s.reviewToken,checklist});const incoming=snapshot(store,B);assert.equal(incoming.items[0].nextAction,s.items[0].nextAction);assert.equal(incoming.items[0].assignee,'Equipe técnica')}finally{cleanup()}});

test('Optional blank summary persists a valid delivery',()=>{const {store,cleanup}=setup([{}]);try{const s=snapshot(store,A);checkout(store,A,'deliver',{summary:'',reviewToken:s.reviewToken,checklist});assert.equal(store.read().handovers.length,1);assert.equal(snapshot(store,B).deliverySummary,'')}finally{cleanup()}});
