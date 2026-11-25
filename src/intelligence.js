'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MOPIntelligence=api;})(globalThis,()=>{
  const O=typeof module==='object'&&module.exports?require('./operations.js'):globalThis.MOPOperations;
  const priorities=['Urgente','Alta','Média','Baixa'];
  const canonical=p=>p==='Atenção'?'Alta':p==='Normal'?'Média':priorities.includes(p)?p:'Média';
  const defaults=()=>({version:1,minutes:{Urgente:30,Alta:120,'Média':480,Baixa:1440},rules:[],nearMinutes:15,staleMinutes:60,criticalMinutes:60});
  const stamp=v=>typeof v==='string'?Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v)?v+'-03:00':v):NaN;
  const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  function validatePolicy(input){
    const p=structuredClone(input),valid=n=>Number.isInteger(n)&&n>=1&&n<=525600;
    if(!p||!priorities.every(k=>valid(p.minutes?.[k]))||!valid(p.nearMinutes)||!valid(p.staleMinutes)||!valid(p.criticalMinutes)||!Array.isArray(p.rules)||p.rules.length>100)throw Error('Configuração de SLA inválida: use minutos inteiros positivos.');
    const used=new Set();p.rules=p.rules.map(r=>{if(typeof r.category!=='string'||!r.category.trim()||r.category.length>80||!priorities.includes(r.priority)||!valid(r.minutes))throw Error('Regra de categoria inválida.');const key=r.category.trim()+'|'+r.priority;if(used.has(key))throw Error('Regra de categoria duplicada.');used.add(key);return {category:r.category.trim(),priority:r.priority,minutes:r.minutes};});
    return {version:Number.isSafeInteger(p.version)?p.version:1,minutes:Object.fromEntries(priorities.map(k=>[k,p.minutes[k]])),rules:p.rules,nearMinutes:p.nearMinutes,staleMinutes:p.staleMinutes,criticalMinutes:p.criticalMinutes};
  }
  function baseline(item,policy=defaults()){
    const priority=canonical(item.priority),minutes=policy.rules.find(r=>r.category===item.category&&r.priority===priority)?.minutes??policy.minutes[priority],start=stamp(item.created_at);
    return {minutes,priority,category:item.category||'',version:policy.version,nearMinutes:Math.min(policy.nearMinutes,minutes),due_at:Number.isFinite(start)?new Date(start+minutes*60000).toISOString():null};
  }
  function sla(item,base=baseline(item),now=new Date()){
    const due=stamp(base.due_at),resolved=item.status==='Resolvido',end=resolved?stamp(item.resolved_at):+now;
    if(!Number.isFinite(due)||!Number.isFinite(end))return {...base,state:'unknown',label:'Sem base de SLA'};
    const remaining=(due-end)/60000,state=end>due?'breached':!resolved&&remaining<=base.nearMinutes?'near':'within';
    return {...base,state,remaining,resolved,label:{breached:'SLA violado',near:'Perto de vencer',within:'Dentro do SLA'}[state]};
  }
  function search(rows,f={},user={},now=new Date(),slas={}){
    if(f.from&&f.to&&f.from>f.to)throw Error('A data inicial deve anteceder a final.');
    const q=normalize(f.q).trim().split(/\s+/).filter(Boolean);
    return rows.filter(x=>{
      if(x.deleted_at&&!(f.includeDeleted&&user.role==='admin')||user.condos!=null&&!user.condos.includes(x.condo))return false;
      if(f.condo&&x.condo!==f.condo||f.status&&x.status!==f.status||f.priority&&canonical(x.priority)!==canonical(f.priority))return false;
      const hay=normalize([x.protocol,x.condo,x.assignee,x.subject,x.description,x.category,x.status,x.priority,x.created_by,x.action_taken,x.next_action,x.reference].join(' '));
      if(!q.every(term=>hay.includes(term))||f.assignee&&!normalize(x.assignee).includes(normalize(f.assignee)))return false;
      const day=Number.isFinite(stamp(x.created_at))?O.dateKey(stamp(x.created_at)):'';
      if(f.from&&day<f.from||f.to&&day>f.to)return false;
      if(f.mine&&!(x.created_identity?.user_id===user.userId||x.assignee_user_id===user.userId||(!x.created_identity?.user_id&&user.display_name&&normalize(x.created_by)===normalize(user.display_name))))return false;
      if(f.overdue&&!(x.status!=='Resolvido'&&stamp(x.deadline)<+now))return false;
      if(f.urgent&&x.priority!=='Urgente'||f.unassigned&&String(x.assignee||'').trim())return false;
      if(f.sla&&slas[x.protocol||String(x.id)]?.state!==f.sla)return false;
      return true;
    });
  }
  function notifications(state,user,policy=defaults(),slas={},now=new Date()){
    const notices=[],push=(type,key,title,detail,extra={})=>notices.push({type,key:type+':'+key,title,detail,...extra});
    const open=state.items.filter(x=>!x.deleted_at&&x.status!=='Resolvido'&&(user.condos==null||user.condos.includes(x.condo)));
    for(const x of open){
      const key=x.protocol||String(x.id),due=stamp(x.deadline),age=(+now-stamp(x.updated_at||x.created_at))/60000,createdAge=(+now-stamp(x.created_at))/60000,extra={itemId:x.id,condo:x.condo,target:'records',severity:'warning'};
      if(due<+now)push('overdue',key+':'+x.deadline,'Registro vencido',x.condo+' · '+x.subject,{...extra,severity:'danger'});
      else if(due>=+now&&due-+now<=policy.nearMinutes*60000)push('deadline',key+':'+x.deadline,'Prazo próximo',x.condo+' · '+x.subject,extra);
      if(x.priority==='Urgente'&&age>=policy.staleMinutes)push('stale',key+':'+x.updated_at,'Urgente sem atualização',Math.floor(age)+' min sem atualização · '+x.condo,{...extra,severity:'danger'});
      if(x.priority==='Urgente'&&createdAge>=0&&createdAge<=policy.criticalMinutes)push('critical',key,'Novo registro crítico',x.condo+' · '+x.subject,{...extra,severity:'danger'});
      const s=slas[key];if(['near','breached'].includes(s?.state))push('sla',key+':'+s.due_at+':'+s.state,s.label,x.condo+' · '+x.subject,{...extra,severity:s.state==='breached'?'danger':'warning'});
    }
    const slot=O.slot({frequency:'shift',start_date:'2020-01-01'},now);
    if(user.role!=='viewer'&&!state.handovers.some(h=>h.receipt_slot===slot&&h.receipt_user_id===user.userId))push('shift',user.userId+':'+slot,'Turno ainda não assumido','Revise a passagem e confirme o recebimento.',{target:'handover',severity:'warning'});
    // due() normalizes its argument; clone to keep this public function pure.
    for(const {template,slot} of O.due(structuredClone(state),now))if(user.condos==null||user.condos.includes(template.condo))push('checklist',template.key+':'+slot,'Checklist não concluído',template.condo+' · '+template.title,{target:'checklists',severity:'warning',condo:template.condo});
    return notices.sort((a,b)=>(b.severity==='danger')-(a.severity==='danger')||a.key.localeCompare(b.key));
  }
  return {priorities,canonical,defaults,stamp,validatePolicy,baseline,sla,search,notifications};
});
