'use strict';
(() => {
  const screen=document.querySelector('#startup');
  const message=document.querySelector('#startupMessage');
  const error=document.querySelector('#startupError');
  const retry=document.querySelector('#startupRetry');
  const content=document.querySelector('#appContent');
  const form=document.createElement('form');form.id='loginForm';form.hidden=true;
  form.innerHTML=`<label for="loginEmail">E-mail</label><input id="loginEmail" type="email" autocomplete="username" maxlength="254" required>
    <label for="loginPassword">Senha</label><input id="loginPassword" type="password" autocomplete="current-password" maxlength="1024" required>
    <label class="login-consent" id="loginConsent"><input id="loginUpload" type="checkbox"> Na primeira conexão, autorizo enviar os registros deste computador para a central configurada.</label>
    <button id="loginSubmit" class="primary" type="submit">Entrar</button>
    <p class="login-help">Acesso restrito aos operadores autorizados. O primeiro login exige internet. Depois, o acesso offline com senha vale por até 7 dias.</p>`;
  message.after(form);
  let running=false,scriptLoaded=false,syncLoaded=false,locked=false;
  const painted=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  function showLogin(status){
    screen.hidden=false;screen.dataset.state='login';screen.setAttribute('aria-busy','false');
    message.textContent='Entre para acessar a central operacional';
    form.hidden=false;retry.hidden=true;
    document.querySelector('#loginConsent').hidden=!status.firstConnection;
    document.querySelector('#loginEmail').focus();
  }
  function loading(text='Carregando central operacional…'){
    screen.hidden=false;screen.dataset.state='loading';screen.setAttribute('aria-busy','true');
    message.textContent=text;error.textContent='';form.hidden=true;retry.hidden=true;
  }
  async function application(){
    loading();await painted();
    if(!scriptLoaded){
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src='app.js';
        script.onload=()=>{scriptLoaded=true;resolve();};
        script.onerror=()=>{script.remove();reject(Error('Não foi possível carregar a interface.'));};
        document.body.appendChild(script);
      });
    }
    if(!window.mopManagementLoaded){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='management.js';script.onload=()=>{window.mopManagementLoaded=true;resolve();};script.onerror=()=>reject(Error('Não foi possível carregar os módulos de gestão.'));document.body.appendChild(script);});}
    if(locked)return;
    await window.initializeMop();
    if(locked)return;
    if(!syncLoaded){const script=document.createElement('script');script.src='sync-ui.js';document.body.appendChild(script);syncLoaded=true;}
    screen.setAttribute('aria-busy','false');
    content.inert=false;content.removeAttribute('aria-hidden');
    screen.dataset.state='ready';document.body.classList.remove('starting');
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)await Promise.all(screen.getAnimations().map(a=>a.finished.catch(()=>{})));
    if(locked)return;
    screen.hidden=true;content.querySelector('[data-tab="overview"]').focus({preventScroll:true});
  }
  function initializationError(reason){
    screen.dataset.state='error';screen.setAttribute('aria-busy','false');
    message.textContent='Não foi possível carregar a central operacional.';
    error.textContent=reason.message||String(reason);retry.hidden=false;retry.focus();
  }
  async function start(){
    if(running)return;running=true;loading();
    try{
      await document.querySelector('#startupLogo').decode();
      if(!window.mopDesktop)throw Error('Abra o MOP pelo aplicativo ou por npm start no projeto.');
      await window.mopDesktop.whenShown();await painted();
      const status=await window.mopDesktop.initialize();
      if(locked)return;
      if(status.authenticated)await application();else showLogin(status);
    }catch(reason){if(!locked)initializationError(reason);}finally{running=false;}
  }
  form.onsubmit=async event=>{
    event.preventDefault();if(running||locked)return;
    running=true;const button=document.querySelector('#loginSubmit');button.disabled=true;error.textContent='';
    screen.dataset.state='authenticating';screen.setAttribute('aria-busy','true');message.textContent='Verificando acesso…';
    try{
      const password=document.querySelector('#loginPassword').value;document.querySelector('#loginPassword').value='';
      const status=await window.mopDesktop.auth('login',{email:document.querySelector('#loginEmail').value,password,uploadExisting:document.querySelector('#loginUpload').checked});
      if(locked)return;
      document.querySelector('#loginEmail').value='';
        if(!status.authenticated)throw Error('Não foi possível autorizar o acesso.');
      try{await application();}catch(reason){if(!locked)initializationError(reason);}
    }catch(reason){
      if(!locked){showLogin({firstConnection:!document.querySelector('#loginConsent').hidden});error.textContent=reason.message;document.querySelector('#loginPassword').focus();}
    }finally{button.disabled=false;running=false;}
  };
  function conceal(){
    document.body.classList.add('starting');content.inert=true;content.setAttribute('aria-hidden','true');
    window.lockMop?.();content.replaceChildren();document.querySelectorAll('dialog').forEach(el=>el.remove());
    screen.hidden=false;screen.dataset.state='loading';form.reset();form.hidden=true;error.textContent='';message.textContent='Sessão bloqueada. Entre novamente.';
  }
  window.mopDesktop?.onLocked(()=>{if(locked)return;locked=true;conceal();location.reload();});
  window.addEventListener('beforeunload',conceal);
  retry.addEventListener('click',start);start();
})();
