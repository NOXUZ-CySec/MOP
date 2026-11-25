'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../desktop/store.cjs');
const {action}=require('../desktop/record-actions96.cjs');
const sessions={
 operator:{userId:'operator-a',display_name:'Operador A',role:'operator',condos:['CEA']},
 other:{userId:'operator-b',display_name:'Operador B',role:'operator',condos:['CEA']},
 supervisor:{userId:'supervisor-1',display_name:'Supervisor',role:'supervisor',condos:['CEA']},
 admin:{userId:'admin-1',display_name:'Admin',role:'admin',condos:null}
};
function setup(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop96-'));
 const store=new Store(dir);
 const state=store.read(),now=new Date().toISOString();
 state.items.push({id:1,protocol:'MOP-TEST-1',condo:'CEA',category:'Segurança',subject:'Teste',description:'Primeira descrição',action_taken:'Nenhuma',status:'Pendente',created_at:now,updated_at:now,created_by:'Operador A',created_identity:{user_id:'operator-a',display_name:'Operador A'}});
 state.items.push({id:2,protocol:'MOP-TEST-2',condo:'CEA',category:'Sistemas',subject:'Outro',description:'Descrição',action_taken:'Nenhuma',status:'Pendente',created_at:now,updated_at:now,created_by:'Operador B',created_identity:{user_id:'operator-b',display_name:'Operador B'}});
 state.nextItem=3;store.write(state);
 return {store,cleanup:()=>{store.close();fs.rmSync(dir,{recursive:true,force:true})}};
}
const input={id:'MOP-TEST-1',condo:'CEA',subject:'Título atualizado',description:'Descrição nova',action_taken:'Teste',category:'Segurança',status:'Em andamento',reason:'Correção do conteúdo original'};
test('operator edits own record, preserving immutable identity and original author',()=>{const {store,cleanup}=setup();try{action(store,sessions.operator,'edit',input);const x=store.read().items[0];assert.equal(x.subject,'Título atualizado');assert.equal(x.created_identity.user_id,'operator-a');assert.equal(x.status,'Em andamento');const audit=JSON.parse(store.db.prepare('select payload from intelligence_audit order by id desc limit 1').get().payload);assert.equal(audit.action,'record.updated');assert.equal(audit.actor.id,'operator-a');assert.equal(audit.detail.changed.edit_reason.after,'Correção do conteúdo original');}finally{cleanup()}});
test('Status-only change is accepted without reason and remains audited',()=>{const {store,cleanup}=setup();try{const x={id:'MOP-TEST-1',condo:'CEA',subject:'Teste',description:'Primeira descrição',action_taken:'Nenhuma',category:'Segurança',status:'Resolvido'};action(store,sessions.operator,'edit',x);const changed=store.read().items[0];assert.equal(changed.status,'Resolvido');assert.equal(changed.subject,'Teste');const audit=JSON.parse(store.db.prepare('select payload from intelligence_audit order by id desc limit 1').get().payload);assert.equal(audit.detail.changed.status.after,'Resolvido');}finally{cleanup()}});
test('operator cannot edit another author record or delete',()=>{const {store,cleanup}=setup();try{assert.throws(()=>action(store,sessions.operator,'edit',{...input,id:'MOP-TEST-2'}),/autoria/);assert.throws(()=>action(store,sessions.operator,'delete',{id:'MOP-TEST-1',reason:'Motivo válido'}),/administradores/);}finally{cleanup()}});
test('supervisor can edit but cannot delete',()=>{const {store,cleanup}=setup();try{action(store,sessions.supervisor,'edit',{...input,id:'MOP-TEST-2'});assert.throws(()=>action(store,sessions.supervisor,'delete',{id:'MOP-TEST-2',reason:'Motivo válido'}),/administradores/);}finally{cleanup()}});
test('admin logical deletion retains record and reason',()=>{const {store,cleanup}=setup();try{action(store,sessions.admin,'delete',{id:'MOP-TEST-1',reason:'Lançamento duplicado'});const x=store.read().items[0];assert.ok(x.deleted_at);assert.equal(x.deleted_reason,'Lançamento duplicado');assert.throws(()=>action(store,sessions.admin,'edit',input),/inexistente|removido/);}finally{cleanup()}});
test('duplication creates new ID and audit identity and retains original',()=>{const {store,cleanup}=setup();try{const result=action(store,sessions.operator,'duplicate',input);const x=store.read();assert.equal(x.items.length,3);assert.equal(x.items[0].subject,'Teste');assert.equal(x.items[2].created_identity.user_id,'operator-a');assert.notEqual(result.protocol,'MOP-TEST-1');}finally{cleanup()}});
test('editing cannot move a record to a different unit',()=>{const {store,cleanup}=setup();try{assert.throws(()=>action(store,sessions.admin,'edit',{...input,condo:'CEA2'}),/unidade/);}finally{cleanup()}});
