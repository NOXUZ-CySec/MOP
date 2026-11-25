'use strict';
(() => {
  const E=MOPOperations.escape;
  let epoch=0,timer,rows=[];
  const host=document.createElement('div');host.className='session-tools';
  host.innerHTML='<div id="sessionIdentity" role="status"></div><button id="notificationBell" type="button" aria-label="Central de Notificações" aria-expanded="false" aria-controls="notificationPanel"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span id="notificationBadge" hidden></span></button>';
  document.querySelector('.topbar .toolbar').prepend(host);
  const panel=document.createElement('section');panel.id='notificationPanel';panel.hidden=true;panel.setAttribute('aria-label','Central de Notificações');panel.innerHTML='<div class="row"><h2>Central de Notificações</h2><button id="closeNotifications" aria-label="Fechar notificações">×</button></div><p class="muted">Histórico pessoal: até 200 avisos dos últimos 30 dias. Horário da primeira detecção nesta estação. A leitura não resolve a pendência.</p><button id="readAllNotifications">Marcar todas como lidas</button><div id="recentNotifications"></div><button id="openOperationalAlerts">Ver Alertas operacionais</button>';
  host.append(panel);
  const bell=host.querySelector('#notificationBell');
  function close(focus=false){panel.hidden=true;bell.setAttribute('aria-expanded','false');if(focus)bell.focus();}
  function identity(){const a=window.mopAccount,receipt=a?window.MOPShiftGate?.receipt():null,d=MOPSessionIdentity.describe(a,receipt);host.querySelector('#sessionIdentity').innerHTML=d?`<span class="session-avatar" aria-hidden="true">${E(d.name.slice(0,1).toUpperCase())}</span><div><strong>${E(d.username||d.name)}</strong><small class="${d.assumed?'assumed':''}">${E(d.shift)}</small></div>`:'';host.hidden=!d;}
  function draw(){const unread=rows.filter(n=>!n.read).length,badge=host.querySelector('#notificationBadge');badge.hidden=!unread;badge.textContent=unread>99?'99+':unread;bell.setAttribute('aria-label',`Central de Notificações, ${unread} não lidas`);host.querySelector('#readAllNotifications').disabled=!unread;
    host.querySelector('#recentNotifications').innerHTML=rows.map(n=>`<article class="personal-notice ${n.read?'read':'unread'} ${E(n.severity)}"><span class="tag">${E(({deadline:'Prazo próximo',overdue:'Vencido',stale:'Sem atualização',critical:'Novo crítico',shift:'Turno',checklist:'Checklist',sla:'SLA'})[n.type]||n.type)} · ${n.severity==='danger'?'Crítico':'Atenção'}</span><h3>${E(n.title)}</h3><p>${E(n.detail)}</p><small>${E(new Date(n.at).toLocaleString('pt-BR'))} · ${n.active?'Ativa':'Histórico'} · ${n.read?'Lida':'Não lida'}</small><div class="actions">${n.read?'':`<button data-read="${E(n.key)}">Marcar como lida</button>`}${n.type==='shift'&&window.mopAccount.role==='viewer'?'':`<button data-open-notice="${E(n.key)}">Abrir</button>`}</div></article>`).join('')||'<p class="empty">Nenhuma notificação recente.</p>';
  }
  async function refresh(){identity();if(!window.mopAccount)return;const token=++epoch;try{const result=await mopDesktop.notifications('snapshot');if(token!==epoch||!window.mopAccount)return;rows=result.history;draw();}catch(e){if(token===epoch)toast(e.message,true);}}
  bell.onclick=()=>{panel.hidden=!panel.hidden;bell.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){refresh();host.querySelector('#closeNotifications').focus();}};
  host.querySelector('#closeNotifications').onclick=()=>close(true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close(true);});
  document.addEventListener('click',e=>{if(!host.contains(e.target))close();});
  host.querySelector('#openOperationalAlerts').onclick=()=>{close(true);tab('alerts');};
  panel.addEventListener('click',async e=>{const read=e.target.closest('[data-read]'),all=e.target.closest('#readAllNotifications'),open=e.target.closest('[data-open-notice]');try{if(read||all){await mopDesktop.notifications(all?'readAll':'read',{key:read?.dataset.read});await refresh();}if(open){const n=rows.find(n=>n.key===open.dataset.openNotice);if(!n)return;if(n.itemId){const item=readStore().items.find(x=>x.id===n.itemId);if(!item)return;document.querySelector('#search').value=item.protocol||item.subject;document.querySelector('#filter').value='all';}close(true);tab(n.target);}}catch(err){toast(err.message,true);}});
  const init=window.initializeMop;window.initializeMop=async()=>{await init();await refresh();clearInterval(timer);timer=setInterval(refresh,30000);};
  const lock=window.lockMop;window.lockMop=()=>{++epoch;clearInterval(timer);rows=[];close();host.querySelector('#sessionIdentity').replaceChildren();host.hidden=true;draw();lock();};
  const originalRefresh=window.refresh;window.refresh=async(...args)=>{const result=await originalRefresh(...args);await refresh();return result;};
  window.MOPNotifications={refresh,identity};
})();
