(()=>{
  const status=document.querySelector('#updateStatus');
  const check=document.querySelector('#checkUpdate');
  const install=document.querySelector('#installUpdate');
  if(!window.mopDesktop?.update||!status||!check||!install)return;
  const render=s=>{
    if(!s)return;
    status.textContent=s.message||'Atualizações automáticas ativadas.';
    install.hidden=s.state!=='ready';
    check.disabled=['checking','downloading'].includes(s.state);
  };
  check.addEventListener('click',async()=>{
    try{render({state:'checking',message:'Verificando atualizações…'});render(await window.mopDesktop.update('check'));}
    catch(error){render({state:'error',message:error.message});}
  });
  install.addEventListener('click',async()=>{
    install.disabled=true;
    status.textContent='Reiniciando para instalar a atualização…';
    try{await window.mopDesktop.update('install');}
    catch(error){install.disabled=false;status.textContent=error.message;}
  });
  window.mopDesktop.onUpdate(render);
  window.mopDesktop.update('status').then(render).catch(()=>{});
})();