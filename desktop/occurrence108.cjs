'use strict';
const crypto=require('node:crypto');
const {visible}=require('./operations.cjs');
const normalizeStatus=s=>s==='Resolvido'||s==='Concluído'?'Concluído':s==='Em andamento'?'Em andamento':'Pendente';
function statusHistory(store,session){
 const allowed=new Map(visible(store.read(),session).items.filter(x=>!x.deleted_at).map(x=>[String(x.protocol||x.id),x]));
 if(!store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='intelligence_audit'").get())return [];
 const raw=store.db.prepare("SELECT id,payload,previous,digest FROM intelligence_audit ORDER BY id").all();
 let previous='';const changes=[];
 for(const row of raw){
  if(row.previous!==previous||row.digest!==crypto.createHash('sha256').update(previous+row.payload).digest('hex'))throw Error('Integridade do histórico local comprometida.');
  previous=row.digest;
  const event=JSON.parse(row.payload),protocol=String(event.detail?.record||'');
  if(event.action!=='record.updated'||!event.detail?.changed?.status||!allowed.has(protocol))continue;
  const change=event.detail.changed.status;
  changes.push({id:'audit-'+row.id,record_protocol:protocol,from:normalizeStatus(change.before),to:normalizeStatus(change.after),at:event.at,actor:String(event.actor?.name||'Operador'),kind:normalizeStatus(change.after)==='Concluído'?'Encerramento':normalizeStatus(change.before)==='Concluído'?'Reabertura':'Atualização de status',source:'Auditoria local'});
 }
 return changes.reverse().slice(0,2000);
}
function evaluate(records,tracking=[],now=Date.now(),hours=24){
 const tracked=new Map(tracking.map(x=>[String(x.record_protocol),x]));
 const items=records.map(r=>{
  const t=tracked.get(String(r.id));
  const effective=t?.priority||r.priority||'Normal',priority=/cr[ií]tic|urgente|emerg/i.test(effective)?'Crítica':/alta/i.test(effective)?'Alta':/m[eé]dia/i.test(effective)?'Média':/baixa/i.test(effective)?'Baixa':'Normal';
  const date=Date.parse(r.occurredAt),ageHours=Number.isFinite(date)?Math.max(0,(now-date)/3600000):null;
  const open=r.status!=='Concluído';
  return {...r,priorityLabel:priority,assigneeId:t?.assigned_user_id||null,ageHours,aged:open&&ageHours!==null&&ageHours>=hours,critical:open&&priority==='Crítica'};
 });
 return {items,critical:items.filter(x=>x.critical).length,aged:items.filter(x=>x.aged).length,unassigned:items.filter(x=>x.status!=='Concluído'&&!x.assigneeId).length};
}
module.exports={statusHistory,evaluate,normalizeStatus};
