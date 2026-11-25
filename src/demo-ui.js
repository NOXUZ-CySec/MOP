'use strict';
// A área de preparo existe apenas na edição de homologação e somente para administradores.
// O painel permanece recolhido por padrão para não poluir a demonstração.
(()=>{
  const startup=document.querySelector('#startup');
  const panel=document.querySelector('#about .about-panel');
  if(!startup||!panel||!window.mopDemo)return;
  function refresh(){
    const existing=document.querySelector('#demoMaintenance');
    const active=startup.hidden&&window.mopAccount?.role==='admin';
    if(!active){existing?.remove();return;}
    if(existing)return;
    const details=document.createElement('details');details.id='demoMaintenance';details.className='demo-maintenance';
    const summary=document.createElement('summary');summary.textContent='Preparação da apresentação (somente administrador)';
    const explanation=document.createElement('p');explanation.textContent='A base possui 14 registros fictícios, histórico e passagens anteriores. Use a restauração apenas entre apresentações: a base atual será arquivada e o MOP reiniciado.';
    const button=document.createElement('button');button.type='button';button.textContent='Restaurar cenário fictício';
    const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    button.onclick=async()=>{
      if(!window.confirm('Restaurar a demonstração? A base local atual será arquivada antes da criação de um novo cenário fictício. O aplicativo reiniciará.'))return;
      button.disabled=true;status.textContent='Preparando restauração segura e reinicialização…';
      try{await window.mopDemo.reset();}catch(error){button.disabled=false;status.textContent='Falha: '+(error.message||String(error));}
    };
    details.append(summary,explanation,button,status);panel.append(details);
  }
  const watcher=new MutationObserver(refresh);
  watcher.observe(startup,{attributes:true,attributeFilter:['hidden']});
  window.mopDesktop.onLocked?.(()=>document.querySelector('#demoMaintenance')?.remove());
  refresh();
})();