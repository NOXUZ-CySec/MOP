'use strict';
const DAY=86400000;
const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
function analyze(input,options={}){
 const now=Number.isFinite(options.now)?options.now:Date.now();
 const days=[1,7,30].includes(options.days)?options.days:30;
 const width=days*DAY,currentStart=now-width,previousStart=currentStart-width;
 const eligible=(input||[]).filter(r=>{const time=Date.parse(r.created_at||r.occurredAt||'');return Number.isFinite(time)&&time<=now&&time>=previousStart});
 const filter=(r)=>((options.condo||'Todos os condomínios')==='Todos os condomínios'||(r.condo||'')===options.condo)&&((options.category||'Todas as categorias')==='Todas as categorias'||r.category===options.category)&&((options.status||'Todos os status')==='Todos os status'||(r.status==='Resolvido'?'Concluído':r.status)===options.status);
 const rows=eligible.filter(filter),current=rows.filter(r=>Date.parse(r.created_at||r.occurredAt)>=currentStart),previous=rows.filter(r=>Date.parse(r.created_at||r.occurredAt)<currentStart);
 const num=(items,type)=>type==='all'?items.length:type==='incidents'?items.filter(r=>r.category!=='Rotina').length:type==='pending'?items.filter(r=>r.status==='Pendente').length:items.filter(r=>r.status==='Em andamento').length;
 const metrics=['all','incidents','pending','progress'].map(type=>{const currentCount=num(current,type),previousCount=num(previous,type),delta=currentCount-previousCount;return {type,current:currentCount,previous:previousCount,delta,percent:previousCount>0?Math.round(delta/previousCount*100):null}});
 const frequency=new Map();
 for(const r of current.filter(r=>r.category!=='Rotina')){
  const label=String(r.subject||r.title||'Sem título').trim(),condo=String(r.condo||'Não informado');const id=key(condo)+'|'+key(label);
  if(!id||id==='|')continue;
  const old=frequency.get(id)||{label,condo,count:0,ids:[]};old.count++;old.ids.push(String(r.protocol||r.id));frequency.set(id,old);
 }
 const recurrence=[...frequency.values()].filter(x=>x.count>=2).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'pt-BR')).slice(0,12);
 const categories=(items)=>{const m=new Map();for(const r of items)m.set(String(r.category||'Não informada'),(m.get(String(r.category||'Não informada'))||0)+1);return m};
 const catC=categories(current),catP=categories(previous);
 const comparison=[...new Set([...catC.keys(),...catP.keys()])].map(label=>({label,current:catC.get(label)||0,previous:catP.get(label)||0})).sort((a,b)=>b.current-a.current||a.label.localeCompare(b.label,'pt-BR'));
 const series=Array.from({length:days},(_,i)=>{const start=currentStart+i*DAY,end=start+DAY;
   return {start:new Date(start).toISOString(),count:current.filter(r=>{const t=Date.parse(r.created_at||r.occurredAt);return t>=start&&t<end}).length}
 });
 return {days,currentStart:new Date(currentStart).toISOString(),previousStart:new Date(previousStart).toISOString(),now:new Date(now).toISOString(),metrics,recurrence,comparison,series,currentCount:current.length,previousCount:previous.length};
}
module.exports={analyze,key};
