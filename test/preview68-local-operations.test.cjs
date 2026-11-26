'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const schedule=require('../desktop/schedule68.cjs'),checklist=require('../desktop/checklist68.cjs');
const manager={userId:'supervisor-1',role:'supervisor'},worker={userId:'operator-1',role:'operator'};
test('Preview68: supervisor can save shift, operator sees it, operator cannot edit',()=>{
 const db=new DatabaseSync(':memory:');schedule.setup(db);
 assert.throws(()=>schedule.action(db,worker,'save',{date:'2026-11-18',kind:'work'}),/Somente supervisão/);
 schedule.action(db,manager,'save',{employeeId:'operator-1',date:'2026-11-18',kind:'extra',reason:'Cobertura'});
 const data=schedule.action(db,worker,'load',{month:'2026-11',employeeId:'supervisor-1'});
 assert.equal(data.employeeId,'operator-1');assert.equal(data.rows[0].kind,'extra');db.close();
});
test('Preview68: swap requires manager approval and cannot be approved twice',()=>{
 const db=new DatabaseSync(':memory:');schedule.setup(db);
 const req=schedule.action(db,worker,'request',{date:'2026-11-19',colleague:'Colega',reason:'Troca autorizada'});
 assert.throws(()=>schedule.action(db,worker,'decide',{id:req.id,status:'approved'}),/supervisão/);
 schedule.action(db,manager,'decide',{id:req.id,status:'approved'});
 assert.equal(schedule.action(db,worker,'load',{month:'2026-11'}).rows[0].kind,'swap');
 assert.throws(()=>schedule.action(db,manager,'decide',{id:req.id,status:'approved'}),/não está pendente/);db.close();
});
test('Preview68: checklist creation restricted and team completion keeps its original author',()=>{
 const db=new DatabaseSync(':memory:');checklist.setup(db);
 assert.throws(()=>checklist.action(db,worker,'create',{title:'Verificar câmeras',period:'Todos'}),/supervisão/);
 const task=checklist.action(db,manager,'create',{title:'Verificar câmeras',period:'Todos'});
 checklist.action(db,worker,'complete',{id:task.id});
 checklist.action(db,manager,'complete',{id:task.id});
 const workerRuns=checklist.action(db,worker,'list').runs;
 const managerRuns=checklist.action(db,manager,'list').runs;
 assert.equal(workerRuns.length,1);
 assert.deepEqual(managerRuns,workerRuns);
 assert.equal(workerRuns[0].task_id,task.id);
 assert.equal(workerRuns[0].completed_by,worker.userId);db.close();
});
