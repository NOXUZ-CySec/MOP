'use strict';
(() => {
 const $=s=>document.querySelector(s),D=MOPOperations,E=D.escape;
 if(!globalThis.MOPPortalConfig?.enabled){$('#loginForm').hidden=true;$('#login h1').textContent='Portal ainda não liberado';$('#login p').textContent='O acesso web e celular será disponibilizado em uma etapa futura.';return;}
 let session=null,state=null,workspace=null,expiry;
 const notice=text=>$('#notice').textContent=text;
 function clear(){session=null;state=null;workspace=null;clearTimeout(expiry);$('#dashboard').hidden=true;$('#login').hidden=false;$('#logout').hidden=true;$('#records').replaceChildren();$('#metrics').replaceChildren();$('#identity').textContent='';$('#loginForm').reset();}
 async function api(path,options={}){if(!MOPPortalConfig?.url||!MOPPortalConfig?.key)throw Error('Portal ainda não configurado pelo administrador.');const response=await fetch(MOPPortalConfig.url+path,{...options,headers:{apikey:MOPPortalConfig.key,...(session?{Authorization:'Bearer '+session.access_token}:{}),'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});const data=await response.json().catch(()=>null);if(!response.ok){if(response.status===401)clear();throw Error(data?.message||data?.error_description||'Não foi possível consultar a central.');}return data;}
 function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function load(){
   if(!session)return;const token=session.access_token;notice('Atualizando dados autorizados…');
   const memberships=await api('/rest/v1/mop_members?select=workspace_id,display_name,role,condos&user_id=eq.'+encodeURIComponent(session.user.id));
   if(session?.access_token!==token)return;
   if(memberships.length!==1){clear();throw Error('Conta sem acesso a uma central única.');}workspace=memberships[0].workspace_id;
   const rows=[];let cursor=0;
   for(;;){const page=await api('/rest/v1/mop_records?select=id,kind,payload,revision&workspace_id=eq.'+workspace+'&revision=gt.'+cursor+'&order=revision&limit=200');if(session?.access_token!==token)return;if(!page.length)break;rows.push(...page);cursor=page.at(-1).revision;if(rows.length>100000)throw Error('Volume excede o limite do portal.');}
   state=D.normalize({items:[],events:[],handovers:[]});for(const r of rows)if(Array.isArray(state[r.kind]))state[r.kind].push({...r.payload,id:r.id});
   state=MOPPrivacy.clean(state);
   $('#filters [name=condo]').innerHTML='<option value="">Todos os autorizados</option>'+[...new Set(state.items.map(x=>x.condo))].map(x=>`<option>${E(x)}</option>`).join('');
   $('#identity').textContent=MOPPrivacy.label(memberships[0].display_name,session.user.id)+' · consulta dos condomínios autorizados';$('#lastUpdate').textContent='Atualizado em '+new Date().toLocaleString('pt-BR');$('#dashboard').hidden=false;$('#login').hidden=true;$('#logout').hidden=false;render();notice('');
 }
 function render(){if(!state)return;const f=Object.fromEntries(new FormData($('#filters'))),m=D.metrics(state,f);$('#metrics').innerHTML=[['Registros',m.total],['Abertos',m.open],['Atrasados',m.late],['Resolvidos',m.resolved]].map(([label,n])=>`<div class="card"><small>${label}</small><strong>${n}</strong></div>`).join('');$('#records').innerHTML=D.select(state,f).map(x=>`<details class="item"><summary>${E(x.subject)} · ${E(x.status)}</summary><p>${E(x.condo)} · ${E(x.protocol)}</p><p>${E(x.description)}</p><p>Responsável: ${E(x.assignee||'Não definido')} · Prazo: ${E(x.deadline||'Não definido')}</p><p>Ação realizada: ${E(x.action_taken)}<br>Próxima ação: ${E(x.next_action)}</p><h3>Histórico</h3>${state.events.filter(e=>e.item_id===x.id).map(e=>`<p class="history-entry"><small>${E(e.at)} · ${E(e.actor)}</small><br>${E(e.detail)}</p>`).join('')}<div class="download-list">${state.attachments.filter(a=>a.item_id===x.id).map(a=>`<button data-attachment="${E(a.id)}">${E(a.name)}</button>`).join('')}</div></details>`).join('')||'<div class="empty">Nenhum registro neste filtro.</div>';$('#records').querySelectorAll('[data-attachment]').forEach(b=>b.onclick=()=>{const a=state.attachments.find(a=>a.id===b.dataset.attachment);if(!a||!['image/png','image/jpeg','application/pdf'].includes(a.mime))return;try{download(Uint8Array.from(atob(a.content),c=>c.charCodeAt(0)),a.name,a.mime);}catch{notice('Anexo inválido.');}});}
 $('#loginForm').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{const values=Object.fromEntries(new FormData(e.target));e.target.reset();session=await api('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify(values)});expiry=setTimeout(()=>{clear();notice('Sessão expirada. Entre novamente.');},Math.max(1,(session.expires_in||3600)-30)*1000);await load();}catch(error){clear();notice(error.message);}finally{b.disabled=false;}};
 $('#logout').onclick=async()=>{try{await api('/auth/v1/logout',{method:'POST'});}catch{}finally{clear();notice('Sessão encerrada.');}};
 $('#refresh').onclick=()=>load().catch(e=>{clear();notice(e.message);});$('#filters').onchange=render;$('#filters').onsubmit=e=>e.preventDefault();
 $('#excel').onclick=()=>{if(state)download(MOPWorkbook.report(D.select(state,Object.fromEntries(new FormData($('#filters'))))),'MOP-relatorio.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');};
 $('#pdf').onclick=()=>{if(!state)return;const w=window.open('','_blank');if(!w){notice('Permita abrir a janela de impressão.');return;}w.opener=null;w.document.write(D.report(state,Object.fromEntries(new FormData($('#filters')))));w.document.close();w.focus();w.print();};
 window.addEventListener('pagehide',clear);
})();
