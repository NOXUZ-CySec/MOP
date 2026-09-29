'use strict';
(() => {
  const D=MOPOperations;
  const slot=()=>D.slot({frequency:'shift',start_date:'2020-01-01'},new Date());
  const receipt=()=>{const s=readStore(),user=window.mopAccount?.userId;return [...s.handovers].reverse().find(h=>h.receipt_slot===slot()&&h.receipt_user_id===user)||null;};
  function allowed(){return !!receipt()}
  function applyLock(){
    const locked=!allowed();window.mopShiftAssumed=!locked;
    document.querySelectorAll('[data-tab="new"],#saveRecord,.save-update,.save-correction,.save-planning,.edit-resolved,.quick-status,[data-toggle-template],#templateForm button').forEach(el=>{if(el)el.disabled=locked;});
    const status=document.querySelector('#shiftReceipt');if(status){const a=receipt();status.textContent=a?`Turno assumido às ${new Date(a.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} por ${a.incoming}`:'Turno pendente de recebimento';status.classList.toggle('shift-assumed-ok',!!a);status.classList.toggle('pending',!a);}
  }
  function critical(){const s=readStore();return s.items.filter(x=>!x.deleted_at&&x.status!=='Resolvido'&&(x.priority==='Urgente'||deadlineBucket(x)==='late'));}
  function pendingDelivery(){const s=readStore();return [...s.handovers].reverse().find(h=>h.delivery_slot&&!h.receipt_at)||null;}
  function modal(){
    const s=readStore(),last=pendingDelivery(),items=s.items.filter(x=>!x.deleted_at&&x.status!=='Resolvido'),crit=critical();
    const d=document.createElement('dialog');d.className='release-dialog';
    d.innerHTML='<form method="dialog"><div class="release-head"><div><p class="eyebrow">RECEBIMENTO OBRIGATÓRIO</p><h2>Assuma o turno antes de operar</h2></div></div><div class="release-body"><div class="shift-gate locked"><p><b>Turno atual:</b> '+slot()+'</p><p><b>Última passagem:</b> '+(last?new Date(last.at).toLocaleString('pt-BR')+' · '+last.outgoing+' → '+last.incoming:'Nenhuma passagem anterior registrada.')+'</p><p><b>Pendências abertas:</b> '+items.length+' · <b>Críticas:</b> '+crit.length+'</p><div class="critical-list">'+(crit.length?crit.map(x=>'<label class="check-line"><input type="checkbox" data-critical="'+esc(x.protocol)+'"> '+esc(x.condo)+' · '+esc(x.subject)+' · '+esc(x.protocol)+'</label>').join(''):'<p class="muted">Nenhuma pendência crítica.</p>')+'</div><label>Observação / justificativa de exceção<textarea id="shiftGateNote" maxlength="1000" placeholder="Opcional; obrigatória apenas se supervisor/admin assumir sem ciência completa."></textarea></label></div></div><div class="release-actions"><button class="primary" id="shiftGateAccept" type="button">Assumir turno</button></div></form>';
    document.body.append(d);d.showModal();
    return new Promise(resolve=>{d.querySelector('#shiftGateAccept').onclick=async()=>{const missing=[...d.querySelectorAll('[data-critical]')].filter(x=>!x.checked),privileged=['supervisor','admin'].includes(window.mopAccount?.role),note=d.querySelector('#shiftGateNote').value.trim();if(missing.length&&!(privileged&&note)){toast(privileged?'Confirme as pendências críticas ou registre uma justificativa.':'Confirme a ciência de todas as pendências críticas.',true);return;}if(!last){toast('Nenhuma entrega de turno está aguardando recebimento. Finalize o turno anterior pela aba Passagem de turno.',true);return;}try{const state=readStore(),now=new Date().toISOString(),current=MOPShift.at(now),h=state.handovers.find(x=>x.id===last.id);if(!h||h.receipt_at)throw Error('Entrega de turno indisponível ou já recebida.');h.incoming=window.mopAccount?.display_name||'Operador';h.receipt_note=note;h.receipt_at=now;h.receipt_slot=slot();h.receipt_user_id=window.mopAccount?.userId;h.receipt_override=missing.length>0;h.critical_protocols=[...d.querySelectorAll('[data-critical]:checked')].map(x=>x.dataset.critical);h.shift=h.shift||current;writeStore(state);d.close();d.remove();applyLock();resolve(true);}catch(e){toast(e.message||String(e),true);}};});
  }
  async function ensure(){applyLock();if(allowed())return receipt();return modal();}
  window.MOPShiftGate={ensure,allowed,applyLock};
})();