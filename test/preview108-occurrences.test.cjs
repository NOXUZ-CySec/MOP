'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../desktop/store.cjs'),{Intelligence}=require('../desktop/intelligence.cjs'),{stampWrite,visible}=require('../desktop/operations.cjs');
const {statusHistory,evaluate}=require('../desktop/occurrence108.cjs');
const A={userId:'op-a',display_name:'Operador A',role:'operator',condos:['CEA']};
const B={userId:'super-b',display_name:'Supervisora',role:'supervisor',condos:['CEA']};
const C={userId:'viewer-c',display_name:'Leitor',role:'viewer',condos:['OUTRA']};
const now=Date.parse('2026-11-21T18:00:00.000Z'),at=days=>new Date(now-days*86400000).toISOString();
function setup(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mopocc108-')),store=new Store(dir);
const s=store.read();s.items=[{id:1,protocol:'MOP-1',condo:'CEA',category:'Segurança',subject:'Falha central',description:'Ocorrência',status:'Pendente',priority:'Crítica',created_at:at(4),updated_at:at(4)},{id:2,protocol:'MOP-2',condo:'OUTRA',category:'Segurança',subject:'Ocorrência restrita',status:'Resolvido',created_at:at(2),updated_at:at(2)}];s.nextItem=3;store.write(s);store.intelligence=new Intelligence(store);
return {store,cleanup:()=>{store.close();fs.rmSync(dir,{recursive:true,force:true})}}}
test('critical incidents, aging and unassigned are counted correctly',()=>{const rows=[{id:'1',status:'Pendente',priority:'Crítica',occurredAt:at(4)},{id:'2',status:'Concluído',priority:'Crítica',occurredAt:at(5)},{id:'3',status:'Em andamento',priority:'Normal',occurredAt:at(.5)}];const x=evaluate(rows,[{record_protocol:'3',assigned_user_id:'operator-a',priority:'Alta'}],now,24);assert.equal(x.critical,1);assert.equal(x.aged,1);assert.equal(x.unassigned,1);assert.equal(x.items[2].priorityLabel,'Alta')});
test('normalizes reopening, closing and non-final transitions',()=>{const x=require('../desktop/occurrence108.cjs');assert.equal(x.normalizeStatus('Resolvido'),'Concluído');assert.equal(x.normalizeStatus('Em andamento'),'Em andamento')});
test('immutable audit shows closing and reopening, with actor and exact record',()=>{const {store,cleanup}=setup();try{
let prior=store.read();let next=visible(prior,B);next.items.find(x=>x.id===1).status='Resolvido';store.write(stampWrite(prior,next,B),B);
prior=store.read();next=visible(prior,B);next.items.find(x=>x.id===1).status='Em andamento';store.write(stampWrite(prior,next,B),B);
const events=statusHistory(store,B);assert.equal(events.length,2);assert.equal(events[0].kind,'Reabertura');assert.equal(events[1].kind,'Encerramento');assert.equal(events[0].record_protocol,'MOP-1');assert.equal(events[0].actor,'Supervisora');
assert.ok(!JSON.stringify(events).includes('MOP-2'));
}finally{cleanup()}});
test('audit cannot leak events to another condominium',()=>{const {store,cleanup}=setup();try{let prior=store.read(),next=visible(prior,B);next.items.find(x=>x.id===1).status='Resolvido';store.write(stampWrite(prior,next,B),B);assert.equal(statusHistory(store,C).length,0)}finally{cleanup()}});
test('UI shows manager assignee filtering, aging filters and status history',()=>{const ui=fs.readFileSync(path.join(__dirname,'../ui-next/src/Occurrences102.tsx'),'utf8');assert.ok(ui.includes('setAssignee'));assert.ok(ui.includes('Pendências antigas'));assert.ok(ui.includes('Críticas abertas'));assert.ok(ui.includes('statusHistory'));assert.ok(ui.includes('historyEntries'));});
