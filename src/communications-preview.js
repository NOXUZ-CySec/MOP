'use strict';
(() => {
  const demo=[
    {id:'m1',sender:'Recepção Barão de Mauá',email:'recepcao@baraodemaua.com.br',time:'08:14',subject:'Solicitação de cadastro - João Silva',preview:'Bom dia, favor realizar o cadastro de acesso do colaborador João Silva...',condo:'Barão de Mauá',category:'Cadastro futuro',status:'Novo',priority:'Normal',unread:true,attachments:['Cadastro_Joao.xlsx']},
    {id:'m2',sender:'Segurança Jundiaí 1',email:'seguranca.cj1@condominiosbbp.com.br',time:'08:37',subject:'Câmera 14 sem comunicação',preview:'Identificamos perda de comunicação da câmera 14 no acesso de veículos...',condo:'Jundiaí 1',category:'Gerenciadora e/ou Dispositivo offline',status:'Novo',priority:'Atenção',unread:true,attachments:['foto_camera14.jpg']},
    {id:'m3',sender:'Operação Gaia Terra',email:'operacao@gaiaterra.com.br',time:'09:02',subject:'Queda de internet - portaria',preview:'Estamos sem acesso aos sistemas online da portaria desde aproximadamente 08:55...',condo:'Gaia Terra',category:'Falta de internet',status:'Novo',priority:'Urgente',unread:true,attachments:[]},
    {id:'m4',sender:'Facilities Extrema',email:'facilities@extrema.com.br',time:'Ontem',subject:'Retorno manutenção nobreak',preview:'Segue retorno da manutenção realizada no nobreak principal...',condo:'Extrema',category:'Equipamento/Manutenção',status:'Vinculado',priority:'Normal',unread:false,attachments:['relatorio_tecnico.pdf'],protocol:'MOP-2026-00418'},
    {id:'m5',sender:'Portaria CEA',email:'portaria@cea.com.br',time:'Ontem',subject:'Solicitação de imagens - doca',preview:'Solicitamos imagens do período entre 14:00 e 14:30 da doca 02...',condo:'CEA',category:'Solicitação de Vídeo/Imagens',status:'Respondido',priority:'Normal',unread:false,attachments:[],protocol:'MOP-2026-00412'}
  ];
  let selected='m1',filter='all',query='';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function integrationGuide(){
    return `<div class="panel comm-integration-guide">
      <div class="comm-guide-head"><div><p class="eyebrow">INTEGRAÇÃO OUTLOOK / MICROSOFT 365</p><h2>Como a integração funcionaria em produção</h2><p class="muted">A ideia é transformar mensagens operacionais em registros rastreáveis no MOP, sem eliminar a revisão humana antes de criar protocolo ou enviar resposta.</p></div><span class="tag">Simulação</span></div>
      <div class="comm-flow">
        <div><b>1</b><strong>Receber</strong><span>Mensagem chega ao Outlook ou caixa operacional.</span></div>
        <div><b>2</b><strong>Classificar</strong><span>MOP sugere condomínio, categoria, prioridade e vínculo.</span></div>
        <div><b>3</b><strong>Revisar</strong><span>Operador confirma remetente, assunto, anexos e contexto.</span></div>
        <div><b>4</b><strong>Vincular</strong><span>Cria novo protocolo ou associa a um registro existente.</span></div>
        <div><b>5</b><strong>Responder</strong><span>Resposta é preparada para revisão ou enviada conforme política.</span></div>
        <div><b>6</b><strong>Auditar</strong><span>Histórico guarda quem leu, vinculou, respondeu e quando.</span></div>
      </div>
      <div class="comm-requirements">
        <div><h3>O que é preciso para ativar</h3><ul>
          <li>Definir se a integração será via Outlook clássico local ou Microsoft Graph / Microsoft 365.</li>
          <li>Criar uma conta técnica ou identidade de aplicação com menor privilégio possível.</li>
          <li>Autorizar quais caixas o MOP pode ler e, separadamente, se pode preparar ou enviar respostas.</li>
          <li>Mapear remetentes, domínios, palavras-chave e empresas para sugerir condomínio e categoria.</li>
          <li>Definir regras para anexos, LGPD, retenção e tratamento de dados pessoais.</li>
          <li>Homologar a integração em ambiente de teste antes de qualquer automação real.</li>
        </ul></div>
        <div><h3>Controles recomendados</h3><ul>
          <li>Operador revisa e classifica; envio real pode exigir confirmação.</li>
          <li>Supervisor acompanha exceções, duplicidades e mensagens sem vínculo.</li>
          <li>Admin configura credenciais, permissões, caixas autorizadas e auditoria.</li>
          <li>Nenhuma exclusão automática de e-mails; o MOP apenas referencia ou registra o vínculo.</li>
          <li>Falhas de conexão não podem apagar mensagens nem impedir o trabalho offline.</li>
        </ul></div>
      </div>
    </div>`;
  }
  function scenarioCards(){
    const scenarios=[
      ['Cadastro de acesso','E-mail com planilha ou dados de colaborador chega da recepção. O MOP sugere Cadastro futuro, identifica condomínio e prepara um protocolo para acompanhamento.'],
      ['Equipamento offline','Mensagem informa câmera, controladora ou dispositivo sem comunicação. O MOP sugere prioridade e pode criar ocorrência já com origem “Outlook”.'],
      ['Solicitação de imagens','E-mail pede imagens de um intervalo específico. O MOP pode criar registro com aviso LGPD e manter o e-mail como referência documental.'],
      ['Retorno de manutenção','Fornecedor responde um chamado existente. O MOP localiza o protocolo citado no assunto ou corpo e sugere anexar o retorno ao histórico.'],
      ['Falha de internet/energia','Portaria relata indisponibilidade. O MOP pode classificar como urgente, abrir protocolo e preparar resposta padrão de ciência.'],
      ['E-mail não operacional','Newsletter, mensagem pessoal ou assunto fora do escopo pode ser marcado como não operacional sem criar registro.']
    ];
    return `<div class="panel comm-scenarios"><div class="lenel-section-head"><div><p class="eyebrow">EXEMPLOS OPERACIONAIS</p><h2>Situações em que Outlook e MOP poderiam trabalhar juntos</h2></div><span class="tag">6 cenários</span></div><div class="comm-scenario-grid">${scenarios.map((s,i)=>`<div><span>${String(i+1).padStart(2,'0')}</span><h3>${esc(s[0])}</h3><p>${esc(s[1])}</p></div>`).join('')}</div></div>`;
  }
  function filtered(){return demo.filter(m=>(filter==='all'||m.status===filter)&&(!query||[m.sender,m.subject,m.condo,m.category,m.protocol||''].join(' ').toLowerCase().includes(query.toLowerCase())));}
  function header(holder){
    holder.innerHTML=`<div class="comm-toolbar"><div class="comm-search-wrap"><input id="commSearch" placeholder="Buscar remetente, assunto, condomínio ou protocolo" value="${esc(query)}"></div><select id="commFilter"><option value="all">Todos</option><option>Novo</option><option>Vinculado</option><option>Respondido</option><option>Ignorado</option></select></div><div id="commMailList"></div>`;
    holder.querySelector('#commFilter').value=filter;
    holder.querySelector('#commSearch').oninput=e=>{query=e.target.value;list();};
    holder.querySelector('#commFilter').onchange=e=>{filter=e.target.value;list();};
  }
  function list(){
    const holder=document.querySelector('#commInbox');if(!holder)return;
    header(holder);const list=holder.querySelector('#commMailList'),data=filtered();
    list.className='comm-inbox';
    list.innerHTML=data.length?data.map(m=>`<button type="button" class="comm-mail ${m.id===selected?'selected':''} ${m.unread?'unread':''}" data-mail="${m.id}" role="listitem"><span class="comm-mail-top"><span><i class="comm-read-dot"></i><strong>${esc(m.sender)}</strong></span><small>${esc(m.time)}</small></span><span class="comm-mail-subject">${esc(m.subject)}</span><span class="comm-mail-preview">${esc(m.preview)}</span><span class="comm-mail-meta"><span class="tag">${esc(m.condo)}</span><span class="tag">${esc(m.status)}</span>${m.attachments.length?'<span class="tag">📎 '+m.attachments.length+'</span>':''}</span></button>`).join(''):'<div class="empty">Nenhum e-mail encontrado.</div>';
    list.querySelectorAll('[data-mail]').forEach(b=>b.onclick=()=>{selected=b.dataset.mail;const m=demo.find(x=>x.id===selected);if(m)m.unread=false;render();});
  }
  function detail(){
    const m=demo.find(x=>x.id===selected)||demo[0],holder=document.querySelector('#commDetail');if(!holder)return;
    holder.innerHTML=`<div class="comm-detail-head"><div><p class="eyebrow">MENSAGEM SELECIONADA</p><h2>${esc(m.subject)}</h2><p class="muted">De ${esc(m.sender)} &lt;${esc(m.email)}&gt; · ${esc(m.time)}</p></div><span class="comm-priority ${m.priority.toLowerCase()}">${esc(m.priority)}</span></div>
    <div class="comm-thread"><div class="comm-thread-head"><strong>Outlook · Caixa de Entrada</strong><span class="tag">${m.unread?'Não lido':'Lido'}</span></div><div class="comm-body"><p>Bom dia,</p><p>${esc(m.preview)}</p><p>Favor confirmar o atendimento assim que possível.</p><p>Atenciosamente,<br>${esc(m.sender)}</p></div>${m.attachments.length?'<div class="comm-attachments"><strong>Anexos</strong>'+m.attachments.map(a=>'<button type="button" class="comm-demo-action">📎 '+esc(a)+'</button>').join('')+'</div>':''}</div>
    <div class="comm-classification"><div><label>Condomínio sugerido</label><select id="commCondo"><option>${esc(m.condo)}</option><option>CEA</option><option>Extrema</option><option>Gaia Terra</option><option>Jundiaí 1</option><option>Jundiaí 2</option></select></div><div><label>Categoria sugerida</label><select id="commCategory"><option>${esc(m.category)}</option><option>Cadastro futuro</option><option>Acesso</option><option>Falta de internet</option><option>Equipamento/Manutenção</option><option>Gerenciadora e/ou Dispositivo offline</option></select></div><div><label>Prioridade sugerida</label><select id="commPriority"><option>${esc(m.priority)}</option><option>Normal</option><option>Atenção</option><option>Urgente</option></select></div></div>
    <div class="comm-link-box"><div><p class="eyebrow">VÍNCULO COM O MOP</p><h3>${m.protocol?'E-mail já vinculado':'Criar registro a partir deste e-mail'}</h3><p class="muted">${m.protocol?'Associado ao protocolo '+esc(m.protocol)+'.':'Os campos acima seriam revisados antes da criação do registro.'}</p></div><div class="actions"><button type="button" class="primary comm-demo-action" data-action="link">${m.protocol?'Abrir '+esc(m.protocol):'Criar registro no MOP'}</button><button type="button" class="comm-demo-action" data-action="existing">Vincular a registro existente</button></div></div>
    <div class="comm-reply-box"><p class="eyebrow">RESPOSTA PELO OUTLOOK</p><h3>Preparar resposta</h3><div class="comm-reply-meta"><span>Para: ${esc(m.email)}</span><span>Assunto: RE: ${esc(m.subject)}</span></div><textarea id="commReply">Prezados,

Informamos que a solicitação referente ao protocolo ${m.protocol||'MOP-AAAA-XXXXX'} está em atendimento.

Atenciosamente,
Monitoramento</textarea><div class="actions"><button type="button" class="primary comm-demo-action" data-action="reply">Abrir resposta no Outlook</button><button type="button" class="comm-demo-action" data-action="ignore">Marcar como não operacional</button></div></div>
    <div class="comm-activity"><p class="eyebrow">HISTÓRICO SIMULADO</p><div><span>08:14</span><p>E-mail recebido do Outlook.</p></div><div><span>08:15</span><p>Classificação automática sugerida pelo MOP.</p></div>${m.protocol?'<div><span>08:18</span><p>Vinculado ao protocolo '+esc(m.protocol)+'.</p></div>':''}</div>
    <p id="commPreviewStatus" class="comm-preview-note">Modo simulação: nenhuma ação altera registros reais ou acessa o Outlook.</p>`;
    holder.querySelectorAll('.comm-demo-action').forEach(b=>b.onclick=()=>{
      const s=document.querySelector('#commPreviewStatus'),a=b.dataset.action||'preview';
      if(a==='ignore')m.status='Ignorado';
      if(a==='link'&&!m.protocol){m.protocol='MOP-2026-TESTE';m.status='Vinculado';}
      if(a==='reply')m.status='Respondido';
      if(s)s.textContent=a==='reply'?'Resposta simulada preparada. Na integração real, o Outlook abriria para revisão antes do envio.':'Ação simulada concluída. Nenhum dado real foi alterado.';
      list();
    });
  }
  function render(){
    const section=document.querySelector('#communications');
    if(section&&!section.querySelector('.comm-integration-guide')){
      const layout=section.querySelector('.comm-layout');
      if(layout)layout.insertAdjacentHTML('beforebegin',integrationGuide()+scenarioCards());
    }
    list();detail();
  }
  window.MOPCommunications={render};
})();