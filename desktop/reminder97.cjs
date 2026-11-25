'use strict';
/* Preview 97: weekday-independent daily reminders, Sao Paulo-local clock. */
const ZONE='America/Sao_Paulo';
function parseTime(value){if(value==null||value==='')return null;const s=String(value).trim();if(!/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(s))throw Error('Horário inválido; use HH:MM.');return s.slice(0,5)+':00';}
function clock(date=new Date()){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(x=>[x.type,x.value]));return {date:parts.year+'-'+parts.month+'-'+parts.day,time:parts.hour+':'+parts.minute};}
function eligible(task,date){const recurrence=task.recurrence||'daily';const weekday=new Date(date+'T12:00:00Z').getUTCDay();if(recurrence==='weekdays')return weekday>=1&&weekday<=5;if(recurrence==='weekly')return Number(task.weekday)===weekday;if(recurrence==='once'||recurrence==='date')return task.scheduled_date===date;return recurrence==='daily';}
function shouldRearm(oldTask,newTime,now=clock()){if(!oldTask?.reminder_time||!newTime)return false;const original=parseTime(oldTask.reminder_time).slice(0,5),updated=parseTime(newTime).slice(0,5);return eligible(oldTask,now.date)&&original<=now.time&&updated>now.time&&updated>original;}
function due(task,done,prior,now=clock(),epoch=Date.now()){
 if(!task||!task.reminder_time||!eligible(task,now.date)||done?.includes(String(task.id)))return false;
 const at=parseTime(task.reminder_time).slice(0,5);
 if(task.period==='Diurno'&&(at<'06:00'||at>='18:00'))return false;
 if(task.period==='Noturno'&&at>='06:00'&&at<'18:00')return false;
 if(now.time<at)return false;
 if(prior&&Number(prior.reminder_revision||0)===Number(task.reminder_revision||0)&&(prior.action==='complete'||prior.action==='dismiss'))return false;
 if(prior&&Number(prior.reminder_revision||0)===Number(task.reminder_revision||0)&&prior.action==='snooze'&&Number(prior.snooze_until||0)>epoch)return false;
 return true;
}
function setup(db){db.exec('CREATE TABLE IF NOT EXISTS checklist97_reminders(user_id TEXT NOT NULL,task_id TEXT NOT NULL,work_date TEXT NOT NULL,action TEXT NOT NULL,snooze_until INTEGER,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,task_id,work_date))');if(!db.prepare('PRAGMA table_info(checklist97_reminders)').all().some(x=>x.name==='reminder_revision'))db.exec('ALTER TABLE checklist97_reminders ADD COLUMN reminder_revision INTEGER NOT NULL DEFAULT 0');}
function receipt(db,userId,taskId,workDate){setup(db);return db.prepare('SELECT action,snooze_until,reminder_revision FROM checklist97_reminders WHERE user_id=? AND task_id=? AND work_date=?').get(userId,taskId,workDate);}
function acknowledge(db,userId,taskId,workDate,action,now=Date.now(),revision=0){if(!['complete','dismiss','snooze'].includes(action))throw Error('Ação de lembrete inválida.');setup(db);const until=action==='snooze'?now+10*60*1000:null;db.prepare('INSERT INTO checklist97_reminders(user_id,task_id,work_date,action,snooze_until,updated_at,reminder_revision) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,task_id,work_date) DO UPDATE SET action=excluded.action,snooze_until=excluded.snooze_until,updated_at=excluded.updated_at,reminder_revision=excluded.reminder_revision').run(userId,taskId,workDate,action,until,new Date(now).toISOString(),revision);return {action,snooze_until:until};}
function recurrence(input={}){const recurrence=String(input.recurrence||'daily');const scheduled_date=input.scheduled_date||null;const weekday=input.weekday==null?null:Number(input.weekday);if(!['daily','weekdays','weekly','once','date'].includes(recurrence))throw Error('Frequência inválida.');if(recurrence==='weekly'&&(!Number.isInteger(weekday)||weekday<0||weekday>6))throw Error('Selecione um dia da semana.');if(['once','date'].includes(recurrence)&&(!/^\d{4}-\d{2}-\d{2}$/.test(scheduled_date||'')||new Date(scheduled_date+'T12:00:00Z').toISOString().slice(0,10)!==scheduled_date))throw Error('Selecione uma data válida.');return {recurrence,scheduled_date:['once','date'].includes(recurrence)?scheduled_date:null,weekday:recurrence==='weekly'?weekday:null};}
module.exports={parseTime,clock,due,eligible,recurrence,shouldRearm,setup,receipt,acknowledge};
