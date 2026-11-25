'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const local=require('../desktop/checklist68.cjs');
const session={role:'supervisor',userId:'test-manager'};
test('Supervisor edits a local routine without changing its identity or creating duplicate',()=>{
 const db=new DatabaseSync(':memory:');try{
  local.setup(db);
  const created=local.action(db,session,'create',{title:'Ronda inicial',period:'Todos',reminder_time:'08:00',recurrence:'daily'});
  const id=created.id;
  const result=local.action(db,session,'edit',{id,title:'Ronda atualizada',period:'Diurno',reminder_time:'09:30',recurrence:'weekly',weekday:3});
  assert.equal(result.updated,true);
  const saved=db.prepare('select * from checklist68 where id=?').get(id);
  assert.equal(saved.title,'Ronda atualizada');assert.equal(saved.period,'Diurno');
  assert.equal(saved.reminder_time,'09:30:00');assert.equal(saved.recurrence,'weekly');assert.equal(saved.weekday,3);
  assert.equal(db.prepare('select count(*) as n from checklist68').get().n,1);
 }finally{db.close()}
});
test('Operators cannot edit routines and inactive routines cannot be modified',()=>{
 const db=new DatabaseSync(':memory:');try{
  local.setup(db);
  const payload={title:'Rotina',period:'Todos',recurrence:'daily'};
  const {id}=local.action(db,session,'create',payload);
  assert.throws(()=>local.action(db,{role:'operator',userId:'test-worker'},'edit',{id,...payload}),/supervisão/);
  local.action(db,session,'disable',{id});
  assert.throws(()=>local.action(db,session,'edit',{id,...payload}),/indisponível/);
 }finally{db.close()}
});
