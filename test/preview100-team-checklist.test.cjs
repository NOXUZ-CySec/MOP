'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const checklist=require('../desktop/checklist68.cjs');
const setup=()=>{const db=new DatabaseSync(':memory:');checklist.setup(db);return db};
test('A single team completion is visible to all operators, without duplicates',()=>{
 const db=setup();const supervisor={userId:'supervisor1',role:'supervisor'},a={userId:'operatorA',role:'operator'},b={userId:'operatorB',role:'operator'};
 try{
  const {id}=checklist.action(db,supervisor,'create',{title:'Ronda de segurança',period:'Todos',recurrence:'daily',reminder_time:'08:00'});
  checklist.action(db,a,'complete',{id});
  assert.equal(checklist.action(db,b,'list').runs.filter(x=>x.task_id===id).length,1);
  assert.equal(checklist.action(db,supervisor,'list').runs.filter(x=>x.task_id===id).length,1);
  checklist.action(db,b,'complete',{id});
  assert.equal(db.prepare('select count(*) as n from checklist100_team_runs where task_id=?').get(id).n,1);
  assert.equal(db.prepare('select completed_by from checklist100_team_runs where task_id=?').get(id).completed_by,'operatorA');
 }finally{db.close()}
});
test('Prior individual completions migrate to a team-wide state without data loss',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec("create table checklist68(id TEXT PRIMARY KEY,title TEXT,period TEXT,enabled INTEGER DEFAULT 1,created_by TEXT,created_at TEXT);create table checklist68_runs(id TEXT PRIMARY KEY,task_id TEXT,user_id TEXT,date TEXT,completed_at TEXT)");
  db.prepare("insert into checklist68_runs values('a','task1','operatorA','2026-11-21','2026-11-21T09:00:00Z')").run();
  db.prepare("insert into checklist68_runs values('b','task1','operatorB','2026-11-21','2026-11-21T09:10:00Z')").run();
  checklist.setup(db);
  assert.equal(db.prepare("select count(*) as n from checklist100_team_runs where task_id='task1'").get().n,1);
  assert.equal(db.prepare('select count(*) as n from checklist68_runs').get().n,2);
  checklist.setup(db);
  assert.equal(db.prepare("select count(*) as n from checklist100_team_runs where task_id='task1'").get().n,1);
 }finally{db.close()}
});
