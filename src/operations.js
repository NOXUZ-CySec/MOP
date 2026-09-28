'use strict';
// Pure domain functions shared by the desktop, portal and tests.
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.MOPOperations=api;})(globalThis,()=>{
  const collections={templates:'nextTemplate',runs:'nextRun',receipts:'nextReceipt',attachments:'nextAttachment'};
  function normalize(s){for(const [k,c] of Object.entries(collections)){s[k]??=[];s[c]??=Math.max(0,...s[k].map(r=>r.id))+1;}return s;}
  const dateKey=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  function slot(t,now=new Date()){
    const today=dateKey(now),start=t.start_date;if(today<start)return null;
    const day=Math.floor((Date.parse(today)-Date.parse(start))/86400000);
    if(t.frequency==='daily')return today;
    if(t.frequency==='weekly')return new Date(Date.parse(start)+Math.floor(day/7)*7*86400000).toISOString().slice(0,10);
    if(t.frequency==='monthly'){
      let [y,m]=today.split('-').map(Number);const d=Number(start.slice(8));
      let value=new Date(Date.UTC(y,m-1,Math.min(d,new Date(Date.UTC(y,m,0)).getUTCDate()))).toISOString().slice(0,10);
      if(value>today){m--;value=new Date(Date.UTC(y,m-1,Math.min(d,new Date(Date.UTC(y,m,0)).getUTCDate()))).toISOString().slice(0,10);}
      return value>=start?value:null;
    }
    if(t.frequency==='shift'){const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(now));return (hour<6?new Date(Date.parse(today)-86400000).toISOString().slice(0,10):today)+(hour>=6&&hour<18?'-D':'-N');}
    return start;
  }
  function due(s,now=new Date()){normalize(s);return s.templates.filter(t=>t.active!==false).map(t=>({template:t,slot:slot(t,now)})).filter(x=>x.slot&&!s.runs.some(r=>r.template_key===x.template.key&&r.slot===x.slot));}
  function alerts(s,now=new Date()){
    const time=+now;
    return s.items.filter(x=>x.status!=='Resolvido').flatMap(x=>{
      const deadline=x.deadline?Date.parse(x.deadline.length===16?x.deadline+':00-03:00':x.deadline):NaN;
      const late=deadline<time,soon=deadline>=time&&deadline-time<=3600000;
      return late||soon||x.priority==='Urgente'?[{item:x,level:late?'late':soon?'soon':'urgent',label:late?'Prazo vencido':soon?'Vence em até 1 hora':'Ocorrência urgente',escalated:late&&time-deadline>=3600000}]:[];
    }).sort((a,b)=>Number(b.escalated)-Number(a.escalated)||(a.item.deadline||'9999').localeCompare(b.item.deadline||'9999'));
  }
  function select(s,f={}){return s.items.filter(x=>(!f.condo||x.condo===f.condo)&&(!f.status||x.status===f.status)&&(!f.from||dateKey(x.created_at)>=f.from)&&(!f.to||dateKey(x.created_at)<=f.to)&&(!f.shift||x.created_shift?.name===f.shift||x.created_shift?.type===f.shift));}
  function metrics(s,f={}){
    const rows=select(s,f),resolved=rows.filter(x=>x.status==='Resolvido');
    const durations=resolved.map(x=>{const e=s.events.filter(e=>e.item_id===x.id&&e.after?.status==='Resolvido').at(-1);return (Date.parse(e?.at||x.resolved_at||x.updated_at)-Date.parse(x.created_at))/3600000;}).filter(n=>Number.isFinite(n)&&n>=0);
    const timed=resolved.filter(x=>x.deadline),onTime=timed.filter(x=>Date.parse(x.resolved_at||x.updated_at)<=Date.parse(x.deadline+(/Z|[+-]\d\d:\d\d$/.test(x.deadline)?'':':00-03:00')));
    const grouped={};for(const x of rows){const k=x.condo+' · '+x.category;grouped[k]=(grouped[k]||0)+1;}
    return {total:rows.length,open:rows.length-resolved.length,resolved:resolved.length,late:alerts({...s,items:rows}).filter(x=>x.level==='late').length,averageHours:durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:null,onTime:timed.length?100*onTime.length/timed.length:null,groups:Object.entries(grouped).sort((a,b)=>b[1]-a[1])};
  }
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatDate=v=>{if(!v)return 'Não definido';const d=new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)?v+':00-03:00':v);return Number.isNaN(+d)?String(v):d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});};
  function report(s,f={}){
    const rows=select(s,f),ids=new Set(rows.map(x=>x.id));
    return '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Relatório MOP</title><style>body{font:12px Arial;color:#173249;margin:30px}h1{color:#087d9e}article{break-inside:avoid;border-bottom:1px solid #ccd6df;padding:14px 0}small{color:#52677c}p{white-space:pre-wrap}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px;text-align:left}@media print{button{display:none}}</style><h1>MOP · Relatório operacional</h1><p>'+escape(f.condo||'Condomínios autorizados')+' · '+escape(f.from||'Início')+' a '+escape(f.to||'Hoje')+'</p><small>Emitido em '+escape(new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))+' · '+rows.length+' registros</small>'+rows.map(x=>'<article><h2>'+escape(x.protocol)+' · '+escape(x.subject)+'</h2><p>'+escape(x.condo)+' · '+escape(x.status)+' · '+escape(x.priority)+'</p><p>'+escape(x.description)+'</p><p>Responsável: '+escape(x.assignee||'Não definido')+' · Prazo: '+escape(formatDate(x.deadline))+'</p><p>Ação: '+escape(x.action_taken)+'\nPróxima ação: '+escape(x.next_action)+'</p><small>Autoria: '+escape(x.created_by)+' · '+escape(formatDate(x.created_at))+'</small><h3>Histórico</h3>'+s.events.filter(e=>e.item_id===x.id).map(e=>'<p>'+escape(formatDate(e.at))+' · '+escape(e.actor)+' · '+escape(e.kind)+'<br>'+escape(e.detail)+'</p>').join('')+'</article>').join('')+'<h2>Passagens de turno</h2>'+s.handovers.filter(h=>{const day=dateKey(h.at);return (!f.from||day>=f.from)&&(!f.to||day<=f.to)&&(!f.condo||(h.snapshot||[]).some(x=>x.condo===f.condo));}).map(h=>'<article><b>'+escape(formatDate(h.at))+' · '+escape(h.outgoing)+' → '+escape(h.incoming)+'</b><p>'+escape(h.note)+'</p><p>Itens críticos reconhecidos: '+escape((h.critical_protocols||[]).join(', ')||'Sem confirmação individual registrada')+'</p></article>').join('')+'</html>';
  }
  function csv(s,f={}){const columns=[['protocol','Protocolo'],['condo','Condomínio'],['subject','Assunto'],['status','Status'],['priority','Prioridade'],['assignee','Responsável'],['deadline','Prazo'],['created_by','Criado por'],['created_at','Criação'],['action_taken','Ação realizada']];const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';return '\uFEFF'+[columns.map(c=>cell(c[1])).join(';'),...select(s,f).map(r=>columns.map(c=>cell(r[c[0]])).join(';'))].join('\r\n');}
  return {collections,normalize,dateKey,slot,due,alerts,select,metrics,report,csv,escape};
});
