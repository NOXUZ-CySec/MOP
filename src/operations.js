'use strict';
// Pure domain functions shared by the desktop, portal and tests.
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.MOPOperations=api;})(globalThis,()=>{
  const privacy=typeof module==='object'&&module.exports?require('./privacy.js'):globalThis.MOPPrivacy;
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
    return s.items.filter(x=>!x.deleted_at&&x.status!=='Resolvido').flatMap(x=>{
      const deadline=x.deadline?Date.parse(x.deadline.length===16?x.deadline+':00-03:00':x.deadline):NaN;
      const late=deadline<time,soon=deadline>=time&&deadline-time<=3600000;
      return late||soon||x.priority==='Urgente'?[{item:x,level:late?'late':soon?'soon':'urgent',label:late?'Prazo vencido':soon?'Vence em até 1 hora':'Ocorrência urgente',escalated:late&&time-deadline>=3600000}]:[];
    }).sort((a,b)=>Number(b.escalated)-Number(a.escalated)||(a.item.deadline||'9999').localeCompare(b.item.deadline||'9999'));
  }
  function select(s,f={}){return s.items.filter(x=>(f.include_deleted===true||!x.deleted_at)&&(!f.condo||x.condo===f.condo)&&(!f.status||x.status===f.status)&&(!f.from||dateKey(x.created_at)>=f.from)&&(!f.to||dateKey(x.created_at)<=f.to)&&(!f.shift||x.created_shift?.name===f.shift||x.created_shift?.type===f.shift));}
  const dayMs=86400000;
  const offsetDay=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*dayMs).toISOString().slice(0,10);
  function validDay(day){return /^\d{4}-\d{2}-\d{2}$/.test(day||'')&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;}
  function period(f={},now=new Date()){
    const today=dateKey(now),preset=f.period||'custom';let from=f.from,to=f.to;
    if(preset!=='custom'){to=today;from=preset==='today'?today:preset==='7d'?offsetDay(today,-6):preset==='30d'?offsetDay(today,-29):preset==='month'?today.slice(0,7)+'-01':null;}
    if(!validDay(from)||!validDay(to)||from>to)throw Error('Informe um intervalo de datas válido.');
    const days=Math.round((Date.parse(to)-Date.parse(from))/dayMs)+1;
    if(days>3660)throw Error('Selecione um intervalo de até 10 anos.');
    return {from,to,days,previous:{from:offsetDay(from,-days),to:offsetDay(from,-1)}};
  }
  function timestamp(value){if(!value)return NaN;return Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value)?value+'-03:00':value);}
  function group(rows,key){const counts=new Map();for(const x of rows){const label=String(key(x)||'Não informado');counts.set(label,(counts.get(label)||0)+1);}return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'));}
  function resolution(x,events){
    const transitions=events.filter(e=>e.item_id===x.id&&e.after?.status==='Resolvido'&&e.before?.status!=='Resolvido'&&Number.isFinite(timestamp(e.at))).sort((a,b)=>timestamp(b.at)-timestamp(a.at));
    const explicit=timestamp(x.resolved_at),event=timestamp(transitions[0]?.at);
    return {at:Number.isFinite(explicit)?explicit:Number.isFinite(event)?event:timestamp(x.updated_at),estimated:!Number.isFinite(explicit)&&!Number.isFinite(event)};
  }
  function summary(rows,events,now){
    const resolved=rows.filter(x=>x.status==='Resolvido');let estimated=0;const durations=[],timed=[];
    for(const x of resolved){const r=resolution(x,events),start=timestamp(x.created_at),deadline=timestamp(x.deadline);if(Number.isFinite(r.at)&&r.at>=start){durations.push((r.at-start)/3600000);if(r.estimated)estimated++;if(Number.isFinite(deadline))timed.push(r.at<=deadline);}}
    return {total:rows.length,open:rows.length-resolved.length,resolved:resolved.length,late:rows.filter(x=>x.status!=='Resolvido'&&timestamp(x.deadline)<+now).length,averageHours:durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:null,onTime:timed.length?100*timed.filter(Boolean).length/timed.length:null,timedCount:timed.length,durationCount:durations.length,estimated};
  }
  function metrics(s,f={},now=new Date(),scope){
    if(scope&&!['supervisor','admin'].includes(scope.role))throw Error('Dashboard exclusivo de supervisores e administradores.');
    // Caller supplies the authorized local snapshot; scope is an additional restriction, never a grant.
    const items=privacy.clean(s.items).filter(x=>!x.deleted_at&&(!scope||scope.condos==null||scope.condos.includes(x.condo)));
    const safe={items,events:s.events||[]};
    const range=f.period||f.from&&f.to?period(f,now):null;
    const effective={...f,...(range?{from:range.from,to:range.to}:{}),include_deleted:false};
    const rows=select(safe,effective),current=summary(rows,safe.events,now);
    const previous=range?summary(select(safe,{...effective,...range.previous}),safe.events,now):null;
    const byShift=group(rows,x=>{if(['Diurno','Noturno'].includes(x.created_shift?.type))return x.created_shift.type;const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(new Date(x.created_at)));return hour>=6&&hour<18?'Diurno':'Noturno';});
    const dates=new Map(group(rows,x=>dateKey(x.created_at)));const timeline=[];
    if(range)for(let i=0;i<range.days;i++){const day=offsetDay(range.from,i);timeline.push([day,dates.get(day)||0]);}
    const changes={};if(previous)for(const key of ['total','open','late','averageHours','onTime']){const a=current[key],b=previous[key];changes[key]={previous:b,delta:a==null||b==null?null:a-b,percent:a==null||b==null||b===0?null:100*(a-b)/b};}
    const byCategory=group(rows,x=>x.category),attention=[];
    if(current.late)attention.push({tone:'danger',title:current.late+' pendência(s) vencida(s)',detail:'Registros do período ainda abertos, com prazo anterior ao momento atual.'});
    const urgent=rows.filter(x=>x.status!=='Resolvido'&&x.priority==='Urgente').length;
    if(urgent)attention.push({tone:'danger',title:urgent+' urgente(s) em aberto',detail:'Prioridade urgente registrada pela operação.'});
    const unassigned=rows.filter(x=>x.status!=='Resolvido'&&!x.assignee?.trim()).length;
    if(unassigned)attention.push({tone:'warning',title:unassigned+' pendência(s) sem responsável',detail:'O campo de acompanhamento ainda não foi preenchido.'});
    const repeat=byCategory.find(([label,n])=>label!=='Não informado'&&n>1);
    if(repeat)attention.push({tone:'info',title:repeat[1]+' registros em '+repeat[0],detail:'Repetição de categoria no período; não comprova reincidência da mesma causa.'});
    return {...current,range,previous,changes,byPriority:group(rows,x=>x.priority),byStatus:group(rows,x=>x.status),byCondo:group(rows,x=>x.condo),byOperator:group(rows,x=>x.created_identity?.display_name||x.created_by),byCategory,byShift,timeline,attention,groups:group(rows,x=>x.condo+' · '+x.category)};
  }
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatDate=v=>{if(!v)return 'Não definido';const d=new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)?v+':00-03:00':v);return Number.isNaN(+d)?String(v):d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});};
  function report(s,f={}){
    s=privacy.clean(s);
    const rows=select(s,f),ids=new Set(rows.map(x=>x.id));
    return '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Relatório MOP</title><style>body{font:12px Arial;color:#173249;margin:30px}h1{color:#087d9e}article{break-inside:avoid;border-bottom:1px solid #ccd6df;padding:14px 0}small{color:#52677c}p{white-space:pre-wrap}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px;text-align:left}@media print{button{display:none}}</style><h1>MOP · Relatório operacional</h1><p>'+escape(f.condo||'Condomínios autorizados')+' · '+escape(f.from||'Início')+' a '+escape(f.to||'Hoje')+'</p><small>Emitido em '+escape(new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))+' · '+rows.length+' registros</small>'+rows.map(x=>'<article><h2>'+escape(x.protocol)+' · '+escape(x.subject)+'</h2><p>'+escape(x.condo)+' · '+escape(x.status)+' · '+escape(x.priority)+'</p><p>'+escape(x.description)+'</p><p>Responsável: '+escape(x.assignee||'Não definido')+' · Prazo: '+escape(formatDate(x.deadline))+'</p><p>Ação: '+escape(x.action_taken)+'\nPróxima ação: '+escape(x.next_action)+'</p><small>Autoria: '+escape(x.created_by)+' · '+escape(formatDate(x.created_at))+'</small><h3>Histórico</h3>'+s.events.filter(e=>e.item_id===x.id).map(e=>'<p>'+escape(formatDate(e.at))+' · '+escape(e.actor)+' · '+escape(e.kind)+'<br>'+escape(e.detail)+'</p>').join('')+'</article>').join('')+'<h2>Passagens de turno</h2>'+s.handovers.filter(h=>{const day=dateKey(h.at);return (!f.from||day>=f.from)&&(!f.to||day<=f.to)&&(!f.condo||(h.snapshot||[]).some(x=>x.condo===f.condo));}).map(h=>'<article><b>'+escape(formatDate(h.at))+' · '+escape(h.outgoing)+' → '+escape(h.incoming)+'</b><p>'+escape(h.note)+'</p><p>Itens críticos reconhecidos: '+escape((h.critical_protocols||[]).join(', ')||'Sem confirmação individual registrada')+'</p></article>').join('')+'</html>';
  }
  function csv(s,f={}){s=privacy.clean(s);const columns=[['protocol','Protocolo'],['condo','Condomínio'],['subject','Assunto'],['status','Status'],['priority','Prioridade'],['assignee','Responsável'],['deadline','Prazo'],['created_by','Criado por'],['created_at','Criação'],['action_taken','Ação realizada']];const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';return '\uFEFF'+[columns.map(c=>cell(c[1])).join(';'),...select(s,f).map(r=>columns.map(c=>cell(r[c[0]])).join(';'))].join('\r\n');}
  return {collections,normalize,dateKey,slot,due,alerts,select,period,metrics,report,csv,escape};
});
