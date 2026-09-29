'use strict';
(() => {
  const key=()=> 'mop:tutorial:v1:'+(window.mopAccount?.userId||'anonymous');
  const steps=[
    {tab:'overview',title:'Bem-vindo ao MOP',text:'O MOP centraliza registros operacionais, pendências, prazos e a continuidade entre turnos. Este tutorial mostra o básico para começar.'},
    {tab:'overview',selector:'#stats',title:'Início',text:'Aqui você acompanha o resumo da operação, prazos, responsáveis e pendências abertas do turno.'},
    {tab:'new',selector:'#newForm',title:'Novo registro',text:'Use esta aba para registrar ocorrências, solicitações e atividades. Preencha o essencial e complemente apenas quando necessário.'},
    {tab:'records',selector:'#list',title:'Registros e histórico',text:'Consulte registros, filtre por status, atualize pendências e acompanhe todo o histórico de alterações.'},
    {tab:'handover',selector:'#handoverFlow',title:'Passagem de turno',text:'O fluxo separa entrega e recebimento. Quem encerra deixa um resumo; quem assume revisa pendências e confirma o recebimento.'},
    {tab:'calendar',selector:'#calGrid',title:'Calendário',text:'Use o calendário para localizar registros e passagens de turno por data.'},
    {tab:'checklists',title:'Checklists e rotinas',text:'Quando liberado para seu perfil, esta área reúne rotinas periódicas e controles operacionais.'},
    {tab:'alerts',title:'Alertas',text:'Acompanhe prazos próximos, itens atrasados e situações urgentes que exigem atenção.'},
    {tab:'reports',title:'Relatórios e indicadores',text:'Perfis de gestão podem gerar relatórios e acompanhar indicadores da operação.'},
    {tab:'permissions',title:'Acessos',text:'Administradores podem gerenciar usuários, perfis e quais condomínios cada conta pode acessar.'},
    {tab:'about',title:'Sobre e ajuda',text:'Na aba Sobre você encontra informações do MOP. O tutorial também pode ser iniciado novamente por lá.'}
  ];
  const seen=()=>localStorage.getItem(key())==='done';
  const mark=()=>localStorage.setItem(key(),'done');
  function focusStep(step){if(step.tab&&typeof window.tab==='function')window.tab(step.tab);return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}
  async function show(force=false){
    if(!force&&seen())return;
    let index=0;const dialog=document.createElement('dialog');dialog.className='tutorial-dialog';
    dialog.innerHTML='<div class="tutorial-card"><div class="tutorial-head"><div><p class="eyebrow">TUTORIAL GUIADO</p><h2 id="tutorialTitle"></h2></div><button id="tutorialClose" type="button" aria-label="Pular tutorial">×</button></div><p id="tutorialText"></p><div class="tutorial-progress"><span id="tutorialCount"></span><div><button id="tutorialPrev" type="button">Voltar</button><button id="tutorialNext" class="primary" type="button">Próximo</button></div></div><button id="tutorialSkip" class="quiet" type="button">Pular tutorial</button></div>';
    document.body.append(dialog);const title=dialog.querySelector('#tutorialTitle'),text=dialog.querySelector('#tutorialText'),count=dialog.querySelector('#tutorialCount'),prev=dialog.querySelector('#tutorialPrev'),next=dialog.querySelector('#tutorialNext');
    async function render(){document.querySelectorAll('.tutorial-target').forEach(x=>x.classList.remove('tutorial-target'));const s=steps[index];await focusStep(s);title.textContent=s.title;text.textContent=s.text;count.textContent=(index+1)+' de '+steps.length;prev.disabled=index===0;next.textContent=index===steps.length-1?'Concluir':'Próximo';if(s.selector){const el=document.querySelector(s.selector);if(el){el.classList.add('tutorial-target');el.scrollIntoView({behavior:'smooth',block:'center'});}}}
    function finish(){document.querySelectorAll('.tutorial-target').forEach(x=>x.classList.remove('tutorial-target'));mark();dialog.close();dialog.remove();}
    prev.onclick=()=>{if(index>0){index--;render();}};next.onclick=()=>{if(index===steps.length-1)finish();else{index++;render();}};dialog.querySelector('#tutorialSkip').onclick=finish;dialog.querySelector('#tutorialClose').onclick=finish;
    dialog.showModal();await render();
  }
  window.MOPTutorial={show,seen};
})();