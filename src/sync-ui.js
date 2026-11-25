'use strict';
(() => {
  if(!window.mopDesktop.sync)return;
  const panel=document.createElement('dialog');panel.id='syncDialog';
  panel.innerHTML=`<div class="sync-dialog-header"><h2>Sincronização entre computadores</h2><button id="closeSync" type="button" aria-label="Fechar sincronização" title="Fechar"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m2 2 10 10M12 2 2 12"/></svg></button></div>
  <p id="syncDetail" role="status"></p><p id="syncCounts"></p><p id="syncLast" class="muted"></p>

  <div class="actions"><button id="syncNow" type="button">Sincronizar agora</button></div>
  <p id="syncFeedback" role="alert"></p><div id="syncConflicts"></div>`;
  document.body.appendChild(panel);
  const button=document.createElement('button');button.id='syncOpen';button.className='desktop-tool';button.innerHTML='<svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7a9 9 0 0 0-15-2L3 7m0-5v5h5M4 17a9 9 0 0 0 15 2l2-2m0 5v-5h-5"/></svg><span>Sincronização</span>';
  document.querySelector('.sidebar-footer').prepend(button);
  const logout=document.createElement('button');logout.id='logoutMop';logout.className='desktop-tool logout-tool';logout.innerHTML='<svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4H4v16h5m5-12 4 4-4 4m-6-4h13"/></svg><span>Sair do MOP</span>';document.querySelector('#openData').after(logout);
  logout.onclick=()=>window.mopDesktop.auth('logout');
  const badge=document.createElement('p');badge.id='syncBadge';badge.setAttribute('role','status');button.after(badge);
  const update=document.createElement('div');update.id='syncUpdate';update.className='notice';update.hidden=true;
  update.innerHTML='Há atualizações de outra máquina. Seus campos em edição foram mantidos. <button type="button">Recarregar registros</button>';
  document.querySelector('#message').after(update);
  const q=s=>panel.querySelector(s);
  let status,dirty=false;
  document.querySelector('#list').addEventListener('input',()=>{dirty=true;});
  document.querySelector('#list').addEventListener('change',()=>{dirty=true;});
  new MutationObserver(()=>{dirty=false;update.hidden=true;}).observe(document.querySelector('#list'),{childList:true});
  update.querySelector('button').onclick=()=>{if(!dirty||confirm('Recarregar os registros e descartar os campos ainda não salvos nesta lista?')){dirty=false;update.hidden=true;refresh();}};
  const labels={local:'Somente neste computador',online:'Sincronizado',offline:'Offline / sincronização pendente',login:'Entre para sincronizar',syncing:'Sincronizando…',conflict:'Conflitos para revisar'};
  function display(s){
    status=s;window.mopSyncBound=s.bound;
    badge.textContent=(labels[s.state]||s.state)+(s.pending?' · '+s.pending+' pendente(s)':'');
    q('#syncDetail').textContent=s.message;
    q('#syncCounts').textContent=s.pending+' alteração(ões) pendente(s) · '+s.conflicts+' conflito(s)';
    q('#syncLast').textContent=(s.display_name?'Conta: '+s.display_name+' · ':'')+(s.lastSync?'Última sincronização: '+new Date(s.lastSync).toLocaleString('pt-BR'):'Ainda não sincronizado.');

    if(s.dataChanged){
      if(dirty){update.hidden=false;}
      else refresh();
      if(panel.open)conflicts();
    }
  }
  const fieldNames={subject:'Assunto',status:'Status',description:'Descrição',action_taken:'Ação realizada',next_action:'Próxima ação',assignee:'Responsável',deadline:'Prazo',updated_by:'Atualizado por',updated_at:'Atualizado em'};
  async function conflicts(){
    try{
      const rows=await window.mopDesktop.sync('conflicts');const root=q('#syncConflicts');root.replaceChildren();
      for(const c of rows){
        const card=document.createElement('div');card.className='panel';
        const title=document.createElement('h3');title.textContent='Conflito · '+(c.local.protocol||c.local.subject||'#'+c.localId);card.append(title);
        const hint=document.createElement('p');hint.textContent='As duas versões estão preservadas. Escolha a versão que deve ficar no registro. A decisão será guardada no banco local.';card.append(hint);
        const table=document.createElement('table');table.className='sync-comparison';
        const header=document.createElement('tr');for(const label of ['Campo','Neste computador','Na central']){const th=document.createElement('th');th.textContent=label;header.append(th);}table.append(header);
        for(const key of new Set([...Object.keys(c.local),...Object.keys(c.remote.payload)])){
          if(JSON.stringify(c.local[key])===JSON.stringify(c.remote.payload[key]))continue;
          const tr=document.createElement('tr');for(const value of [fieldNames[key]||key,c.local[key],c.remote.payload[key]]){const td=document.createElement('td');td.textContent=typeof value==='object'?JSON.stringify(value,null,2):String(value??'');tr.append(td);}table.append(tr);
        }card.append(table);
        for(const [choice,label] of [['local','Usar versão deste computador'],['remote','Usar versão da central']]){
          if(choice==='local'&&c.kind!=='items')continue;
          const b=document.createElement('button');b.type='button';b.textContent=label;
          b.onclick=async()=>{b.disabled=true;try{display(await window.mopDesktop.sync('resolve',{id:c.id,choice,version:c.remote.version}));await conflicts();}catch(e){q('#syncFeedback').textContent=e.message;}finally{b.disabled=false;}};card.append(b);
        }root.append(card);
      }
    }catch(e){q('#syncFeedback').textContent=e.message;}
  }
  button.onclick=async()=>{panel.showModal();try{display(await window.mopDesktop.sync('status'));await conflicts();}catch(e){q('#syncFeedback').textContent=e.message;}};
  q('#closeSync').onclick=()=>panel.close();
  q('#syncNow').onclick=async()=>{try{display(await window.mopDesktop.sync('now'));await conflicts();}catch(e){q('#syncFeedback').textContent=e.message;}};

  window.mopDesktop.onSync(display);
  window.addEventListener('online',()=>window.mopDesktop.sync('now').catch(()=>{}));
  window.mopDesktop.sync('status').then(display).catch(e=>{badge.textContent='Sincronização indisponível: '+e.message;});
})();
