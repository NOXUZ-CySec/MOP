'use strict';
const checklist=require('./checklist68.cjs');
const {clock}=require('./reminder97.cjs');
function applicable(t,date,period){
 const recurrence=t.recurrence||'daily',weekday=new Date(date+'T12:00:00Z').getUTCDay();
 const due=recurrence==='daily'||recurrence==='weekdays'&&weekday>=1&&weekday<=5||recurrence==='weekly'&&Number(t.weekday)===weekday||['once','date'].includes(recurrence)&&t.scheduled_date===date;
 return due&&(t.period==='Todos'||t.period===period);
}
function fromChecklist(rows,now=new Date()){
 const today=rows.date||clock().date;
 const hr=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(now));
 const period=hr>=6&&hr<18?'Diurno':'Noturno';
 const done=new Set((rows.runs||[]).map(r=>String(r.task_id)));
 const tasks=(rows.tasks||[]).filter(t=>applicable(t,today,period)).map(t=>({
  id:String(t.id),title:String(t.title),period:String(t.period),
  reminder_time:t.reminder_time||null,done:done.has(String(t.id))
 }));
 return {date:today,period,scope:rows.scope,tasks};
}
function snapshot(store,session,now=new Date()){
 if(!session?.userId)throw Error('Sessão não autenticada.');
 checklist.setup(store.db);
 return fromChecklist(checklist.action(store.db,session,'list'),now);
}
module.exports={snapshot,applicable,fromChecklist};
