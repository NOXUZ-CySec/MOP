'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const r=require('../desktop/reminder97.cjs');
const date=(x,time='12:00')=>({date:x,time});
const item=(extra={})=>({id:'task-1',period:'Todos',reminder_time:'08:30:00',recurrence:'daily',...extra});
test('Frequency options include daily, weekdays, weekly day, once and date-specific',()=>{
 const d='2026-11-23'; // Monday
 assert.equal(r.eligible(item(),d),true);
 assert.equal(r.eligible(item({recurrence:'weekdays'}),'2026-11-22'),false);
 assert.equal(r.eligible(item({recurrence:'weekdays'}),d),true);
 assert.equal(r.eligible(item({recurrence:'weekly',weekday:1}),d),true);
 assert.equal(r.eligible(item({recurrence:'weekly',weekday:2}),d),false);
 assert.equal(r.eligible(item({recurrence:'date',scheduled_date:d}),d),true);
 assert.equal(r.eligible(item({recurrence:'date',scheduled_date:d}),'2026-11-24'),false);
 assert.equal(r.eligible(item({recurrence:'once',scheduled_date:d}),d),true);
 assert.equal(r.eligible(item({recurrence:'once',scheduled_date:d}),'2026-11-24'),false);
});
test('Reminders trigger after time, not before, and are suppressed after completion/dismissal',()=>{
 const t=item();const now=date('2026-11-23','08:40');
 assert.equal(r.due(t,[],null,date('2026-11-23','08:20')),false);
 assert.equal(r.due(t,[],null,now),true);
 assert.equal(r.due(t,['task-1'],null,now),false);
 assert.equal(r.due(t,[],{action:'dismiss'},now),false);
 assert.equal(r.due(t,[],{action:'snooze',snooze_until:200000},now,100000),false);
 assert.equal(r.due(t,[],{action:'snooze',snooze_until:200000},now,200001),true);
});
test('Day and night periods match the scheduled clock',()=>{
 assert.equal(r.due(item({period:'Diurno',reminder_time:'08:30:00'}),[],null,date('2026-11-23','09:00')),true);
 assert.equal(r.due(item({period:'Noturno',reminder_time:'08:30:00'}),[],null,date('2026-11-23','09:00')),false);
 assert.equal(r.due(item({period:'Noturno',reminder_time:'20:30:00'}),[],null,date('2026-11-23','21:00')),true);
});
test('Validate frequency, exact weekday and date',()=>{
 assert.deepEqual(r.recurrence({recurrence:'weekly',weekday:3}),{recurrence:'weekly',scheduled_date:null,weekday:3});
 assert.equal(r.recurrence({recurrence:'date',scheduled_date:'2026-11-25'}).scheduled_date,'2026-11-25');
 assert.throws(()=>r.recurrence({recurrence:'weekly',weekday:7}),/dia da semana/);
 assert.throws(()=>r.recurrence({recurrence:'once',scheduled_date:'2026-02-30'}));
 assert.throws(()=>r.parseTime('25:89'));
});
test('Per-user/day dismissal and snooze are stored independently',()=>{
 const db=new DatabaseSync(':memory:');
 r.setup(db);r.acknowledge(db,'user1','task1','2026-11-23','dismiss');
 assert.equal(r.receipt(db,'user1','task1','2026-11-23').action,'dismiss');
 assert.equal(r.receipt(db,'user2','task1','2026-11-23'),undefined);
 assert.equal(r.receipt(db,'user1','task1','2026-11-24'),undefined);
 const x=r.acknowledge(db,'user1','task1','2026-11-23','snooze',1000);
 assert.equal(x.snooze_until,601000);
 assert.equal(r.receipt(db,'user1','task1','2026-11-23').action,'snooze');
 db.close();
});
