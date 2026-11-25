'use strict';
(() => {
  const D=MOPOperations;
  const slot=()=>D.slot({frequency:'shift',start_date:'2020-01-01'},new Date());
  const receipt=()=>{const s=readStore(),user=window.mopAccount?.userId;return [...s.handovers].reverse().find(h=>h.receipt_slot===slot()&&h.receipt_user_id===user)||null;};
  function allowed(){return !!receipt()}
  function applyLock(){
    const locked=window.mopAccount?.role==='viewer'||!allowed();window.mopShiftAssumed=!locked;
    document.querySelectorAll('[data-tab="new"],#saveRecord,.save-update,.save-correction,.save-planning,.edit-resolved,.quick-status,[data-toggle-template],#templateForm button').forEach(el=>{if(el)el.disabled=locked;});
    const status=document.querySelector('#shiftReceipt');if(status){const a=receipt();status.textContent=a?`Turno assumido às ${new Date(a.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} por ${a.incoming}`:'Turno pendente de recebimento';status.classList.toggle('shift-assumed-ok',!!a);status.classList.toggle('pending',!a);}
  }
  function critical(){const s=readStore();return s.items.filter(x=>!x.deleted_at&&x.status!=='Resolvido'&&(x.priority==='Urgente'||deadlineBucket(x)==='late'));}
  function pendingDelivery(){const s=readStore();return [...s.handovers].reverse().find(h=>h.delivery_slot&&!h.receipt_at)||null;}
  function modal(){
    const s=readStore(),last=pendingDelivery(),items=s.items.filter(x=>!x.deleted_at&&x.status!=='Resolvido'),crit=critical();
    const d=document.createElement('dialog');d.className='release-dialog shift-receipt-dialog';
    d.innerHTML='<form method="dialog"><div class="release-head"><div><p class="eyebrow">RECEBIMENTO OBRIGATÓRIO</p><h2>Assuma o turno antes de operar</h2><p class="muted">Revise o essencial e confirme somente as pendências críticas.</p></div></div><div class="release-body"><div class="shift-gate locked"><div class="shift-gate-summary"><div><span>Turno</span><strong>'+esc(slot())+'</strong></div><div><span>Pendências</span><strong>'+items.length+'</strong></div><div class="'+(crit.length?'danger':'')+'"><span>Críticas</span><strong>'+crit.length+'</strong></div></div>'+(last?'<p class="shift-gate-last"><b>Última passagem:</b> '+esc(last.outgoing)+' → aguardando seu recebimento · '+new Date(last.delivered_at||last.at).toLocaleString('pt-BR')+'</p>':'<p class="shift-gate-last muted">Sem entrega anterior disponível. O recebimento deste turno será registrado normalmente.</p>')+'<div class="critical-list">'+(crit.length?crit.map(x=>'<label class="check-line"><input type="checkbox" data-critical="'+esc(x.protocol)+'" data-read-protocol="'+esc(x.protocol)+'" data-read-version="'+esc(MOPHandover.version(x))+'"> <span><strong>'+esc(x.subject)+'</strong><small>'+esc(x.condo)+' · '+esc(x.protocol)+'</small></span></label>').join(''):'<div class="shift-gate-ok">Nenhuma pendência crítica para confirmar.</div>')+'</div><details class="shift-gate-note"><summary>Adicionar observação / justificativa</summary><textarea id="shiftGateNote" maxlength="1000" placeholder="Opcional. Para supervisor/admin, torna-se obrigatória se assumir sem confirmar todas as críticas."></textarea></details><p id="shiftGateError" role="alert" aria-live="assertive"></p></div></div><div class="release-actions"><button class="primary" id="shiftGateAccept" type="button">Assumir turno</button></div></form>';


    const guide=document.createElement('details');guide.className='shift-gate-guide';
    guide.innerHTML='<summary>Como funciona o aceite deste turno?</summary><ol><li>Confira qual turno está sendo recebido e o total de pendências.</li><li>Leia os itens críticos e marque ciência de cada um. Se houver divergência, registre uma observação.</li><li>Clique em <strong>Assumir turno</strong> para registrar o recebimento com seu usuário. Em seguida, o guia rápido apresentará os menus.</li></ol>';
    guide.open=!window.MOPTutorial?.seen();d.querySelector('.release-body').prepend(guide);if(window.mopDemo&&allowed()){const notice=document.createElement('p');notice.className='shift-gate-demo-note';notice.textContent='Prévia de homologação: este turno já foi recebido. A janela é exibida novamente para avaliação visual; nenhuma segunda confirmação será gravada.';d.querySelector('.release-body').prepend(notice);d.querySelector('#shiftGateAccept').textContent='Concluir prévia do recebimento';}
    document.body.append(d);d.showModal();
    return new Promise(resolve=>{
      const button=d.querySelector('#shiftGateAccept'),feedback=d.querySelector('#shiftGateError');
      button.onclick=async()=>{
        if(button.disabled)return;
        feedback.textContent='';
        const missing=[...d.querySelectorAll('[data-critical]')].filter(x=>!x.checked),privileged=['supervisor','admin'].includes(window.mopAccount?.role),note=d.querySelector('#shiftGateNote').value.trim();
        if(!allowed()&&missing.length&&!(privileged&&note)){feedback.textContent=privileged?'Confirme as pendências críticas ou registre uma justificativa.':'Confirme a ciência de todas as pendências críticas.';return;}
        button.disabled=true;
        try{
          if(!allowed()){
            const delivery=pendingDelivery(),critical_protocols=[...d.querySelectorAll('[data-critical]:checked')].map(x=>x.dataset.critical),read_versions=Object.fromEntries([...d.querySelectorAll('[data-read-protocol]:checked')].map(x=>[x.dataset.readProtocol,x.dataset.readVersion]));
            if(delivery){
              await request('/api/handovers/receive','POST',{delivery_id:delivery.id,receipt_note:note,critical_protocols,read_versions,receipt_override:privileged&&missing.length>0});
            }else{
              const state=readStore(),now=new Date().toISOString(),current=MOPShift.at(now),id=state.nextHandover++,open=state.items.filter(x=>!x.deleted_at&&x.status!=='Resolvido');
              state.handovers.push({id,at:now,delivered_at:null,shift:current,outgoing:'Sem entrega anterior',handover_note:'',note:'Início de turno sem entrega anterior disponível.',delivery_slot:null,delivery_user_id:null,incoming:window.mopAccount?.display_name||'Operador',receipt_note:note,receipt_at:now,receipt_slot:slot(),receipt_user_id:window.mopAccount?.userId,receipt_override:privileged&&missing.length>0,critical_protocols,read_versions,open_ids:JSON.stringify(open.map(x=>x.id)),snapshot:open.map(x=>JSON.parse(JSON.stringify(x)))});
              writeStore(state);
            }
          }
          if(!allowed())throw Error('O recebimento não foi confirmado. Tente novamente.');
          d.close();d.remove();await refresh();applyLock();resolve(true);
        }catch(e){feedback.textContent=e.message||String(e);}
        finally{button.disabled=false;}
      };
    });
  }
  async function ensure(){applyLock();if(window.mopAccount?.role==='viewer')return null;if(window.mopDemo)return modal();if(allowed())return receipt();return modal();}
  const originalApplyLock=applyLock;
  applyLock=function(){originalApplyLock();window.MOPNotifications?.identity();};
  window.MOPShiftGate={ensure,allowed,applyLock,receipt};
})();
