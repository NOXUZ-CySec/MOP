'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MOPHandover=api;})(globalThis,()=>{
  const I=typeof module==='object'&&module.exports?require('./intelligence.js'):globalThis.MOPIntelligence;
  const shift=now=>(typeof module==='object'&&module.exports?require('./shift.js'):globalThis.MOPShift).at(now);
  const checklist=[{key:'pending',label:'Revisei as pendências, responsáveis e próximos passos.'},{key:'deadlines',label:'Conferi os vencimentos nas próximas 12 horas e os atrasos.'},{key:'continuity',label:'Registrei as orientações necessárias para a continuidade.'}];
  const stamp=I.stamp;
  const version=x=>x.updated_at||x.created_at||'';
  // This is the same required-review policy used when an operator starts a shift.
  const isCritical=(x,now=new Date())=>['Urgente','Alta','Crítica','Atenção'].includes(x.priority)||stamp(x.deadline)<+now;
  function analyze(state,user,now=new Date()){
    const rows=state.items.filter(x=>!x.deleted_at&&(user.condos==null||user.condos.includes(x.condo))),open=rows.filter(x=>x.status!=='Resolvido');
    const start=stamp(shift(now).start_at),end=+now,inPeriod=v=>stamp(v)>=start&&stamp(v)<=end;
    const rank=x=>({Urgente:0,'Crítica':0,Alta:1,Atenção:1,'Média':2,Normal:2,Baixa:3})[x.priority]??2;
    const late=x=>stamp(x.deadline)<end;
    const ordered=[...open].sort((a,b)=>Number(late(b))-Number(late(a))||rank(a)-rank(b)||(stamp(a.deadline)||Infinity)-(stamp(b.deadline)||Infinity)||String(a.protocol||a.id).localeCompare(String(b.protocol||b.id)));
    const critical=ordered.filter(x=>isCritical(x,now));
    const soon=ordered.filter(x=>stamp(x.deadline)>=end&&stamp(x.deadline)<=end+12*3600000);
    const stale=ordered.filter(x=>Number.isFinite(stamp(version(x)))&&end-stamp(version(x))>=60*60000);
    const ids=new Set(rows.map(x=>x.id)),events=(state.events||[]).filter(e=>ids.has(e.item_id)&&inPeriod(e.at));
    const counts={open:open.length,critical:critical.length,overdue:open.filter(late).length,created:rows.filter(x=>inPeriod(x.created_at)).length,updated:new Set(events.filter(e=>e.kind!=='Criado').map(e=>e.item_id)).size,soon:soon.length,stale:stale.length};
    const text=`${shift(now).type} · ${shift(now).date}: ${counts.created} registro(s) criado(s), ${counts.updated} registro(s) com eventos de atualização no período. Na entrega: ${counts.open} pendência(s), ${counts.critical} crítica(s), ${counts.overdue} vencida(s), ${counts.soon} com prazo nas próximas 12h e ${counts.stale} sem atualização há 60 min ou mais.`;
    return {open:ordered,critical,top:ordered.slice(0,5),soon,stale,counts,text,generated_at:now.toISOString(),period_start:shift(now).start_at,condos:[...new Set(rows.map(x=>x.condo))]};
  }
  function token(state,user){
    return JSON.stringify(state.items.filter(x=>!x.deleted_at&&x.status!=='Resolvido'&&(user.condos==null||user.condos.includes(x.condo))).map(x=>[
      x.protocol,x.status,x.priority,x.deadline,version(x),x.condo,x.subject||'',x.description||'',x.action_taken||'',x.assignee||'',x.next_action||''
    ]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
  }
  function summary(plan){return {version:1,condos:plan.condos,text:plan.text,counts:plan.counts,generated_at:plan.generated_at,period_start:plan.period_start,top:plan.top.map(x=>x.protocol),soon:plan.soon.map(x=>x.protocol),stale:plan.stale.map(x=>x.protocol)};}
  function validateDelivery(row,state,user,now){
    if(user.role==='viewer')throw Error('Seu perfil permite somente consulta.');
    if(row.review_token!==token(state,user))throw Error('As pendências mudaram. Atualize a passagem e revise o checklist novamente.');
    if(!Array.isArray(row.delivery_checklist)||!checklist.every(c=>row.delivery_checklist.includes(c.key)))throw Error('Conclua todos os itens do checklist de entrega.');
    row.auto_summary=summary(analyze(state,user,new Date(now)));row.delivery_checklist=checklist.map(c=>({key:c.key,label:c.label,at:now,user_id:user.userId}));delete row.review_token;
  }
  return {checklist,version,isCritical,analyze,token,summary,validateDelivery};
});
