'use strict';
(() => {
  const releases=[
    {version:'2.2.2',title:'Passagem de turno e onboarding',items:['Passagem de turno reformulada em duas etapas independentes: entrega e recebimento.','Autoria automática pelo usuário autenticado, sem campos manuais redundantes.','Ciência de pendências críticas aplicada somente no recebimento do turno.','Tutorial guiado no primeiro acesso, com opção de pular e refazer pela aba Sobre.','Tutorial adaptado ao perfil do usuário e apresentação visual menos intrusiva.','Sincronização atualizada para permitir completar uma entrega com o recebimento sem reabrir passagens já concluídas.']},
    {version:'2.2.1',title:'Correção do status Resolvido',items:['Correção do travamento ao marcar registros como Resolvido pelo seletor rápido.','Confirmação migrada para modal próprio do MOP, preservando foco e interação no Electron.']},
    {version:'2.2.0',title:'Fluxo operacional e experiência',items:['Novidades do MOP exibidas após o login e antes da operação.','Recebimento obrigatório do turno antes de qualquer escrita operacional.','Login com usuário ou e-mail + senha.','Indicador permanente de turno assumido e trilha de auditoria.','Melhorias visuais do status, expansores e estabilidade da interface.']},
    {version:'2.1.2',title:'Registros e permissões',items:['Troca rápida de status direto no registro, com diferenciação visual.','Atualizações identificadas automaticamente pelo usuário autenticado.','Backup manual restrito a supervisor e administrador.','Remoção da importação/exportação da base operacional; relatórios permanecem disponíveis.']},
    {version:'2.1.1',title:'Atualização automática',items:['Primeira versão com verificação e download de atualizações pelo próprio MOP.']}
  ];
  const key=()=> 'mop:release-notes:'+(window.mopAccount?.userId||'anonymous');
  function seen(){try{return JSON.parse(localStorage.getItem(key())||'[]')}catch{return []}}
  function mark(v){const values=new Set(seen());values.add(v);localStorage.setItem(key(),JSON.stringify([...values]));}
  function html(list){return list.map(r=>'<section class="release-entry"><h3>MOP '+r.version+' · '+r.title+'</h3><ul>'+r.items.map(i=>'<li>'+i+'</li>').join('')+'</ul></section>').join('')}
  async function show(force=false){
    const pending=force?releases:releases.filter(r=>!seen().includes(r.version));if(!pending.length)return;
    const dialog=document.createElement('dialog');dialog.className='release-dialog';
    dialog.innerHTML='<form method="dialog"><div class="release-head"><div><p class="eyebrow">NOVIDADES DO MOP</p><h2>O que mudou</h2></div><button value="cancel" aria-label="Fechar">×</button></div><div class="release-body">'+html(pending)+'</div><div class="release-actions"><button class="primary" value="ok">Entendi, continuar</button></div></form>';
    document.body.append(dialog);dialog.addEventListener('close',()=>{if(dialog.returnValue==='ok')pending.forEach(r=>mark(r.version));dialog.remove();});dialog.showModal();
    await new Promise(resolve=>dialog.addEventListener('close',resolve,{once:true}));
  }
  window.MOPReleaseNotes={show,releases};
})();