'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const checklist=require('../desktop/checklist68.cjs'),reminder=require('../desktop/reminder97.cjs');
const manager={role:'supervisor',userId:'supervisor-test'},operator={role:'operator',userId:'operator-test'};
const today=reminder.clock().date;
const hour=(n)=>String(n).padStart(2,'0')+':00';
test('Moving a fired 10:00 routine to 11:00 at 10:30 re-arms its reminder',()=>{
 assert.equal(reminder.shouldRearm({reminder_time:'10:00:00',recurrence:'daily'},'11:00',{date:today,time:'10:30'}),true);
 assert.equal(reminder.shouldRearm({reminder_time:'10:00:00',recurrence:'daily'},'11:00',{date:today,time:'11:10'}),false);
 assert.equal(reminder.shouldRearm({reminder_time:'12:00:00',recurrence:'daily'},'13:00',{date:today,time:'10:30'}),false);
 assert.equal(reminder.shouldRearm({reminder_time:'10:00:00',recurrence:'daily'},'09:00',{date:today,time:'10:30'}),false);
});
test('Earlier dismissal does not prevent reminder after new scheduled revision',()=>{
 const t={id:'task',recurrence:'daily',period:'Diurno',reminder_time:'11:00:00',reminder_revision:1};
 const prior={action:'dismiss',reminder_revision:0};
 assert.equal(reminder.due(t,[],prior,{date:today,time:'10:59'}),false);
 assert.equal(reminder.due(t,[],prior,{date:today,time:'11:00'}),true);
 assert.equal(reminder.due(t,[],{action:'complete',reminder_revision:1},{date:today,time:'11:00'}),false);
});
test('Team completion remains in history but edited time permits new completion on same date',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  checklist.setup(db);
  const {id}=checklist.action(db,manager,'create',{title:'Ronda',period:'Diurno',reminder_time:'10:00',recurrence:'daily'});
  checklist.action(db,operator,'complete',{id});
  assert.equal(checklist.action(db,operator,'list').runs.length,1);
  const real=reminder.clock;
  const now=reminder.clock();
  // Simulate the 10:30-to-11:00 reschedule independently of machine time by using the same predicate.
  assert.equal(reminder.shouldRearm({reminder_time:'10:00:00',recurrence:'daily'},'11:00',{date:today,time:'10:30'}),true);
  // Force the local wall clock to 10:30 for a deterministic integration test.
  const originalDate=global.Date;
  class FakeDate extends originalDate{
   constructor(...args){super(...(args.length?args:[today+'T13:30:00Z']))}
   static now(){return originalDate.parse(today+'T13:30:00Z')}
  }
  global.Date=FakeDate;
  try{
   const edited=checklist.action(db,manager,'edit',{id,title:'Ronda',period:'Diurno',reminder_time:'11:00',recurrence:'daily'});
   assert.equal(edited.rescheduled,true);
   assert.equal(edited.reminder_revision,1);
   assert.equal(checklist.action(db,operator,'list').runs.length,0);
   checklist.action(db,operator,'complete',{id});
   assert.equal(checklist.action(db,operator,'list').runs.length,1);
   const history=db.prepare('select reminder_revision from checklist100_team_runs where task_id=? order by reminder_revision').all(id);
   assert.deepEqual(history.map(x=>x.reminder_revision),[0,1]);
  }finally{global.Date=originalDate}
 }finally{db.close()}
});
test('Existing reminder receipt migrates and accepts new revision',()=>{
 const db=new DatabaseSync(':memory:');
 try{db.exec("create table checklist97_reminders(user_id TEXT,task_id TEXT,work_date TEXT,action TEXT,snooze_until INTEGER,updated_at TEXT,PRIMARY KEY(user_id,task_id,work_date))");
 db.exec("insert into checklist97_reminders values('u','t','2026-11-21','dismiss',null,'2026-11-21T13:00:00Z')");
 assert.equal(reminder.receipt(db,'u','t','2026-11-21').reminder_revision,0);
 reminder.acknowledge(db,'u','t','2026-11-21','complete',1000,1);
 assert.equal(reminder.receipt(db,'u','t','2026-11-21').reminder_revision,1);
 }finally{db.close()}
});
