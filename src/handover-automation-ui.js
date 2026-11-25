'use strict';
(() => {
 const H=MOPHandover,E=MOPOperations.escape;
 const date=v=>v?new Date(MOPIntelligence.stamp(v)).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Sem prazo';
 const listing=rows=>rows.length?rows.map(x=>`<li><strong>${E(x.protocol)} · ${E(x.subject)}</strong><br>${E(x.condo)} · ${E(x.priority)} · Prazo: ${E(date(x.deadline))}<br>Responsável: ${E(x.assignee||'Não definido')} · Próxima ação: ${E(x.next_action||'Não registrada')}</li>`).join(''):'<li>Nenhum registro neste grupo.</li>';
 const shiftLabel=p=>`${p.period_start?date(p.period_start):'Início do turno'} → agora`;
function plan(state=readStore(),account=window.mopAccount){
 const p=H.analyze(state,account),c=p.counts;
 const badge=(label,n,critical=false)=>`<div class="${critical&&n?'danger':''}"><span>${label}</span><strong>${n}</strong></div>`;
 const primary=badge('Pendências',c.open)+badge('Críticas',c.critical,true)+badge('Vencidas',c.overdue,true)+badge('Próx. 12h',c.soon);
 const secondary=badge('Criados',c.created)+badge('Atualizados',c.updated)+badge('Sem atualização',c.stale);
 const group=[['5 pendências prioritárias',p.top],['Vencimentos nas próximas 12 horas',p.soon],['Registros sem atualização',p.stale]];
 return `<div class="handover-automation">
 <div class="handover-summary-head"><div><span class="handover-kicker">VISÃO RÁPIDA</span><h3>Situação do turno</h3><p class="handover-summary-period">${E(shiftLabel(p))}</p></div><span class="handover-summary-status ${c.critical||c.overdue?'attention':'ok'}">${c.critical||c.overdue?'Requer atenção':'Sem criticidades'}</span></div>
 <div class="handover-summary-kpis">${primary}</div>
 <details class="handover-extra-data"><summary>Mais indicadores e análise detalhada</summary><div class="handover-summary-kpis handover-summary-kpis-extra">${secondary}</div><p class="handover-summary-note">${E(c.open?c.open+' pendência(s) para continuidade do turno.':'Nenhuma pendência aberta para continuidade do turno.')} <span>Atualizado em ${E(date(p.generated_at))} · horário de Brasília</span></p><div class="handover-auto-grid">${group.map(([title,rows])=>`<details><summary>${title} (${rows.length})</summary><ul>${listing(rows)}</ul></details>`).join('')}</div></details>
 </div>`;
}
 function readings(state=readStore(),account=window.mopAccount){const p=H.analyze(state,account),critical=new Set(p.critical.map(x=>x.protocol));return `<h4>Leitura individual das pendências</h4><p class="muted">Críticas: confirmação obrigatória. Demais pendências: leitura opcional, registrada por usuário e versão do registro.</p>`+p.open.map(x=>`<label class="check-line"><input type="checkbox" data-read-protocol="${E(x.protocol)}" data-read-version="${E(H.version(x))}" ${critical.has(x.protocol)?`data-critical="${E(x.protocol)}"`:''}>${critical.has(x.protocol)?'Crítica · ':''}${E(x.condo)} · ${E(x.subject)} · ${E(x.protocol)}</label>`).join('');}
 function saved(h){return h.auto_summary?`<div class="handover-readonly"><h4>Resumo automático preservado na entrega</h4><p>${E(h.auto_summary.text)}</p><small>${E(date(h.auto_summary.generated_at))}</small><p>Checklist: ${(h.delivery_checklist||[]).map(c=>E(c.label)).join(' · ')}</p></div>`:'';}
 function arrangeHandover(){
   const list=document.querySelector('#handoverItems');
   const cards=[...list.querySelectorAll(':scope > .compact-pending')];
   if(cards.length>5){
     const more=document.createElement('details');more.className='handover-more-records';
     const summary=document.createElement('summary');summary.textContent='Mostrar mais '+(cards.length-5)+' pendência(s)';
     more.append(summary);cards.slice(5).forEach(c=>more.append(c));list.append(more);
     more.addEventListener('toggle',()=>{summary.textContent=more.open?'Ocultar pendências adicionais':'Mostrar mais '+(cards.length-5)+' pendência(s)';});
   }
   document.querySelectorAll('#handoverHistory .handover-notes').forEach(notes=>{
     const details=document.createElement('details');details.className='handover-history-notes';
     const summary=document.createElement('summary');summary.textContent='Notas e ressalvas desta passagem';
     notes.replaceWith(details);details.append(summary,notes);
   });
 }
 const original=renderHandover;renderHandover=function(open){original(open);arrangeHandover();const state=readStore(),flow=document.querySelector('#handoverFlow');flow.insertAdjacentHTML('afterbegin',plan(state));const pending=[...state.handovers].reverse().find(h=>h.delivery_slot&&!h.receipt_at);if(pending)flow.insertAdjacentHTML('afterbegin',saved(pending));const list=document.querySelector('#criticalReceiptList');if(list)list.innerHTML=readings(state);
 const form=document.querySelector('#deliverShiftForm');if(form){form.dataset.reviewToken=H.token(state,window.mopAccount);form.elements.handover_note.required=false;form.querySelector('label[for="handover-note"]').textContent='Orientações adicionais para o próximo turno (opcional)';form.querySelector('button').insertAdjacentHTML('beforebegin',`<fieldset class="delivery-checklist"><legend>Checklist obrigatório de entrega</legend>${H.checklist.map(c=>`<label class="check-line"><input type="checkbox" required data-delivery-check="${c.key}">${E(c.label)}</label>`).join('')}</fieldset>`);}
 if(window.mopAccount?.role==='viewer'){flow.querySelectorAll('input,textarea,button').forEach(x=>x.disabled=true);}
 };
 const audit=h=>h.receipt_at?`<details class="handover-audit"><summary>Auditoria do recebimento</summary><div class="handover-audit-content"><p><b>Entrega:</b> ${E(h.outgoing||'Não identificada')} · ${E(date(h.delivered_at||h.at))}</p><p><b>Recebimento:</b> ${E(h.incoming||'Não identificado')} · ${E(date(h.receipt_at))}</p><p><b>Ciências registradas:</b> ${Number(h.read_confirmations?.length||0)}</p><p><b>Exceção supervisionada:</b> ${h.receipt_override?'Sim — conferir justificativa no histórico':'Não'}</p>${h.receipt_note?`<p><b>Ressalva:</b> ${E(h.receipt_note)}</p>`:''}</div></details>`:'';
 const card=handoverCard;handoverCard=function(h){return card(h)+saved(h)+audit(h)+(h.read_confirmations?.length?`<details class="handover-reading-history"><summary>Leituras individuais (${h.read_confirmations.length})</summary>${h.read_confirmations.map(r=>`<p>${E(r.protocol)} · versão ${E(date(r.version))} · lido por ${E(h.incoming||'Conta autenticada')} em ${E(date(r.at))}</p>`).join('')}</details>`:'');};
 window.MOPHandoverUI={plan,readings,saved};
})();
