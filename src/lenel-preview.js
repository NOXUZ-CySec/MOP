'use strict';
(() => {
  const people=[
    {id:'L001',name:'João Silva',company:'Prestadora Alpha',badge:'1045832',condo:'Barão de Mauá',level:'Administrativo',status:'Ativo',validity:'31/12/2026'},
    {id:'L002',name:'Mariana Costa',company:'BBP Serviços',badge:'2049917',condo:'Jundiaí 1',level:'Operacional',status:'Ativo',validity:'30/11/2026'},
    {id:'L003',name:'Carlos Mendes',company:'Terceirizada Beta',badge:'',condo:'Gaia Terra',level:'Visitante temporário',status:'Sem badge',validity:'15/10/2026'}
  ];
  const importRows=[
    {name:'Ana Souza',doc:'CPF 413.***.***-09',company:'Prestadora Gamma',cost:'CC-218',shift:'Diurno',badge:'3088120',condo:'Jundiaí 2',level:'Operacional',state:'Novo'},
    {name:'Bruno Lima',doc:'RG 52.***.***-7',company:'Prestadora Gamma',cost:'CC-218',shift:'Noturno',badge:'1045832',condo:'Barão de Mauá',level:'Operacional',state:'Conflito badge'},
    {name:'Camila Rocha',doc:'CPF 381.***.***-44',company:'BBP Serviços',cost:'CC-105',shift:'Diurno',badge:'2049917',condo:'Jundiaí 1',level:'Administrativo',state:'Conflito badge'},
    {name:'Diego Martins',doc:'CPF 297.***.***-18',company:'Terceirizada Delta',cost:'CC-330',shift:'Noturno',badge:'7001452',condo:'Gaia Terra',level:'Portaria',state:'Novo'},
    {name:'Elisa Nunes',doc:'RG 44.***.***-2',company:'Terceirizada Delta',cost:'CC-330',shift:'Diurno',badge:'8112290',condo:'CEA',level:'Operacional',state:'Cadastro existente'}
  ];
  let selected='L001',query='',migrationStage=0,events=[
    {time:'09:11',type:'Leitora offline',where:'Jundiaí 2 · Portaria 01',category:'Gerenciadora e/ou Dispositivo offline',status:'Novo'},
    {time:'09:08',type:'Acesso negado recorrente',where:'Barão de Mauá · Catraca 03',category:'Acesso',status:'Novo'},
    {time:'08:54',type:'Porta forçada',where:'CEA · Entrada técnica',category:'Ocorrência',status:'Novo'}
  ];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function filtered(){return people.filter(p=>!query||[p.name,p.company,p.badge,p.condo,p.level].join(' ').toLowerCase().includes(query.toLowerCase()));}
  function personList(){
    const data=filtered();
    return data.length?data.map(p=>`<button type="button" class="lenel-person-card ${p.id===selected?'selected':''}" data-person="${p.id}"><span><strong>${esc(p.name)}</strong><small>${esc(p.company)}</small></span><span class="tag">${esc(p.status)}</span><span class="lenel-person-mini">Badge ${esc(p.badge||'—')} · ${esc(p.condo)}</span></button>`).join(''):'<div class="empty">Nenhum cardholder encontrado.</div>';
  }
  function selectedDetail(){
    const p=people.find(x=>x.id===selected)||people[0];
    return `<div class="lenel-detail-head"><div><p class="eyebrow">CARDHOLDER SELECIONADO</p><h2>${esc(p.name)}</h2><p class="muted">${esc(p.company)} · ID simulado ${esc(p.id)}</p></div><span class="tag">${esc(p.status)}</span></div>
    <div class="lenel-person-meta expanded"><span><b>Badge</b>${esc(p.badge||'Não associado')}</span><span><b>Condomínio</b>${esc(p.condo)}</span><span><b>Nível atual</b>${esc(p.level)}</span><span><b>Validade</b>${esc(p.validity)}</span></div>
    <div class="lenel-edit-grid"><label>Nível de acesso<select id="lenelLevel"><option>${esc(p.level)}</option><option>Administrativo</option><option>Operacional</option><option>Visitante temporário</option><option>Portaria</option></select></label><label>Validade<input id="lenelValidity" value="${esc(p.validity)}"></label></div>
    <div class="actions"><button type="button" class="primary lenel-action" data-action="update">Simular atualização</button><button type="button" class="lenel-action" data-action="badge">${p.badge?'Bloquear badge':'Associar badge'}</button><button type="button" class="lenel-action" data-action="history">Ver histórico</button></div>
    <div id="lenelDetailStatus" class="comm-preview-note">Selecione uma ação para simular o retorno do OnGuard.</div>
    <div id="lenelHistory" class="lenel-history" hidden><div><span>Hoje 08:02</span><p>Consulta de cardholder realizada.</p></div><div><span>Ontem 17:46</span><p>Nível de acesso confirmado.</p></div></div>`;
  }
  function importTable(){
    return importRows.map((r,i)=>`<tr><td>${i+1}</td><td><strong>${esc(r.name)}</strong><small>${esc(r.doc)}</small></td><td>${esc(r.company)}<small>${esc(r.cost)} · ${esc(r.shift)}</small></td><td>${esc(r.badge)}</td><td>${esc(r.condo)}<small>${esc(r.level)}</small></td><td><span class="tag ${r.state.includes('Conflito')?'danger-tag':''}">${esc(r.state)}</span></td></tr>`).join('');
  }
  function conflictRows(){
    const conflicts=[
      {badge:'1045832',current:'João Silva',target:'Bruno Lima',currentCompany:'Prestadora Alpha',targetCompany:'Prestadora Gamma'},
      {badge:'2049917',current:'Mariana Costa',target:'Camila Rocha',currentCompany:'BBP Serviços',targetCompany:'BBP Serviços'}
    ];
    return conflicts.map((c,i)=>`<div class="badge-conflict"><label><input type="checkbox" class="badge-release" data-conflict="${i}" checked><span><strong>Badge ${esc(c.badge)}</strong><small>Atual: ${esc(c.current)} · ${esc(c.currentCompany)}</small><small>Novo destino: ${esc(c.target)} · ${esc(c.targetCompany)}</small></span></label><span class="tag">Reatribuição</span></div>`).join('');
  }
  function migrationPanel(){
    const summary=migrationStage===0?'Planilha pronta para validação.':migrationStage===1?'Conflitos identificados. Revise as badges que serão liberadas.':migrationStage===2?'Desvinculação simulada concluída. As badges estão livres para nova associação.':'Migração simulada concluída: badges reaplicadas e acessos vinculados.';
    return `<div class="panel lenel-bulk"><div class="lenel-section-head"><div><p class="eyebrow">IMPORTAÇÃO EM MASSA</p><h2>Planilha → Cardholders → Badges → Acessos</h2><p class="muted">Exemplo de lote com 5 linhas. O mesmo fluxo pode ser usado para 10 a 120+ cadastros.</p></div><span class="tag">Simulação</span></div>
    <div class="bulk-steps"><div class="${migrationStage>=0?'active':''}"><b>1</b><span>Validar planilha</span></div><div class="${migrationStage>=1?'active':''}"><b>2</b><span>Resolver badges</span></div><div class="${migrationStage>=2?'active':''}"><b>3</b><span>Reatribuir</span></div><div class="${migrationStage>=3?'active':''}"><b>4</b><span>Relatório</span></div></div>
    <div class="bulk-summary"><span><b>5</b> linhas</span><span><b>2</b> novos</span><span><b>1</b> existente</span><span><b>2</b> conflitos de badge</span></div>
    <div class="bulk-table-wrap"><table class="bulk-table"><thead><tr><th>#</th><th>Colaborador</th><th>Empresa / CC / Turno</th><th>Badge</th><th>Acesso</th><th>Resultado</th></tr></thead><tbody>${importTable()}</tbody></table></div>
    <div class="badge-migration"><div><p class="eyebrow">BADGES JÁ VINCULADAS</p><h3>Liberação em massa antes da nova associação</h3><p class="muted">Quando uma badge da planilha já pertence a outro colaborador, o MOP deve mostrar o vínculo atual e exigir revisão antes de qualquer remoção/desvinculação.</p></div>
    <div class="badge-conflicts">${conflictRows()}</div>
    <div class="lenel-warning"><strong>Proteção recomendada em produção:</strong> nunca apagar/desvincular badges automaticamente só porque aparecem na planilha. O sistema deve exigir prévia, identidade do operador, confirmação privilegiada e trilha de auditoria. Cadastros antigos podem permanecer preservados mesmo após a badge ser removida.</div></div>
    <div class="bulk-actions actions"><button type="button" id="bulkValidate" class="primary">1. Validar planilha</button><button type="button" id="bulkRelease" ${migrationStage<1?'disabled':''}>2. Simular liberação das badges</button><button type="button" id="bulkReassign" ${migrationStage<2?'disabled':''}>3. Reatribuir badges e acessos</button><button type="button" id="bulkReport" ${migrationStage<3?'disabled':''}>Ver relatório final</button></div>
    <p id="bulkStatus" class="comm-preview-note">${esc(summary)}</p>
    <div id="bulkReportPanel" class="bulk-report" hidden><div><strong>5</strong><span>processados</span></div><div><strong>2</strong><span>novos cardholders</span></div><div><strong>1</strong><span>cadastro atualizado</span></div><div><strong>2</strong><span>badges reatribuídas</span></div><div><strong>7</strong><span>níveis de acesso aplicados</span></div><div><strong>0</strong><span>erros pendentes</span></div></div></div>`;
  }
  function eventCards(){
    return events.map((e,i)=>`<div class="lenel-event-card"><div><strong>${esc(e.type)}</strong><small>${esc(e.time)} · ${esc(e.where)}</small></div><span class="tag">${esc(e.category)}</span><div class="actions"><button type="button" class="lenel-event-action" data-event="${i}">Criar registro no MOP</button><button type="button" class="lenel-event-action" data-ignore="${i}">Ignorar</button></div></div>`).join('');
  }
  function render(){
    const root=document.querySelector('#lenelPreview');if(!root)return;
    root.innerHTML=`<div class="lenel-statusbar"><span><i class="live-dot"></i> Simulação de serviço Lenel disponível</span><span>Última consulta: agora</span><span>Escrita real: desativada</span></div>
    <div class="lenel-grid enhanced"><div class="panel"><p class="eyebrow">BUSCA NO LENEL</p><h2>Cardholders e badges</h2><div class="lenel-search"><input id="lenelSearch" placeholder="Nome, empresa, badge, condomínio ou nível" value="${esc(query)}"><button type="button" id="lenelSearchBtn">Buscar</button></div><div id="lenelPeopleList" class="lenel-person-list">${personList()}</div></div>
    <div class="panel"><div id="lenelSelected">${selectedDetail()}</div></div></div>
    ${migrationPanel()}
    <div class="panel lenel-create"><div class="lenel-section-head"><div><p class="eyebrow">NOVO CADASTRO INDIVIDUAL</p><h2>Pré-validação para envio</h2></div><span class="tag">Simulação</span></div><div class="lenel-form"><label>Nome completo<input id="newLenelName" value="Ana Souza"></label><label>Empresa<input value="Prestadora Gamma"></label><label>Badge<input id="newLenelBadge" value="3088120"></label><label>Condomínio<select><option>Jundiaí 2</option><option>Barão de Mauá</option><option>CEA</option></select></label><label>Nível de acesso<select><option>Operacional</option><option>Administrativo</option><option>Visitante temporário</option></select></label><label>Validade<input value="31/10/2026"></label></div><div class="lenel-validation"><span>✓ Campos obrigatórios preenchidos</span><span>✓ Badge sem duplicidade na simulação</span><span>✓ Nível permitido para o condomínio</span></div><div class="actions"><button type="button" class="primary lenel-create-action">Simular criação no Lenel</button></div><p id="lenelCreateStatus" class="comm-preview-note">Nenhum dado será enviado ao OnGuard.</p></div>
    <div class="panel lenel-events"><div class="lenel-section-head"><div><p class="eyebrow">EVENTOS DO LENEL</p><h2>Eventos que poderiam alimentar o MOP</h2></div><span class="tag">${events.length} pendente(s)</span></div><div id="lenelEventsList" class="lenel-event-list">${eventCards()}</div></div>`;
    root.querySelector('#lenelSearch').oninput=e=>{query=e.target.value;root.querySelector('#lenelPeopleList').innerHTML=personList();bindPeople(root);};
    root.querySelector('#lenelSearchBtn').onclick=()=>{root.querySelector('#lenelPeopleList').innerHTML=personList();bindPeople(root);};
    bindPeople(root);bindDetail(root);bindEvents(root);bindBulk(root);
    root.querySelectorAll('.lenel-create-action').forEach(b=>b.onclick=()=>{root.querySelector('#lenelCreateStatus').textContent='Simulação concluída: cardholder criado, badge associado e nível de acesso aplicado.';});
  }
  function bindBulk(root){
    const status=root.querySelector('#bulkStatus');
    root.querySelector('#bulkValidate').onclick=()=>{migrationStage=1;render();};
    root.querySelector('#bulkRelease').onclick=()=>{const checked=[...root.querySelectorAll('.badge-release:checked')];if(!checked.length){status.textContent='Nenhuma badge selecionada para liberação.';return;}migrationStage=2;render();};
    root.querySelector('#bulkReassign').onclick=()=>{migrationStage=3;render();};
    root.querySelector('#bulkReport').onclick=()=>{root.querySelector('#bulkReportPanel').hidden=false;status.textContent='Relatório final exibido. Em produção, esta etapa também geraria auditoria por colaborador e por badge.';};
  }
  function bindPeople(root){root.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>{selected=b.dataset.person;root.querySelector('#lenelPeopleList').innerHTML=personList();root.querySelector('#lenelSelected').innerHTML=selectedDetail();bindPeople(root);bindDetail(root);});}
  function bindDetail(root){
    root.querySelectorAll('.lenel-action').forEach(b=>b.onclick=()=>{
      const p=people.find(x=>x.id===selected),s=root.querySelector('#lenelDetailStatus');
      if(b.dataset.action==='update'){p.level=root.querySelector('#lenelLevel').value;p.validity=root.querySelector('#lenelValidity').value;s.textContent='Simulação concluída: nível de acesso e validade atualizados com sucesso.';}
      if(b.dataset.action==='badge'){p.status=p.badge?'Bloqueado':'Ativo';if(!p.badge)p.badge='SIM-4099112';s.textContent=p.status==='Bloqueado'?'Simulação concluída: badge bloqueado.':'Simulação concluída: badge associado ao cardholder.';}
      if(b.dataset.action==='history'){root.querySelector('#lenelHistory').hidden=!root.querySelector('#lenelHistory').hidden;s.textContent='Histórico simulado exibido abaixo.';}
    });
  }
  function bindEvents(root){
    root.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>{const e=events[Number(b.dataset.event)];e.status='Vinculado';b.textContent='Registro MOP criado';b.disabled=true;});
    root.querySelectorAll('[data-ignore]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.ignore);events.splice(i,1);root.querySelector('#lenelEventsList').innerHTML=eventCards();bindEvents(root);});
  }
  window.MOPLenelPreview={render};
})();