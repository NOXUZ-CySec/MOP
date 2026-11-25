'use strict';
(() => {
  const version='2.3.0-preview.10-first-access';
  const keyFor=account=>'mop:tutorial:'+version+':'+account.userId+':'+account.role;
  function stepsFor(account){
    if(!account?.userId||!['viewer','operator','supervisor','admin'].includes(account.role))return [];
    const writer=account.role!=='viewer';
    return [
      ...(writer?[{tab:'overview',selector:'#shiftReceipt',title:'1. Aceite da passagem de turno',text:'Ao entrar, o MOP solicita o recebimento do turno. Confira o turno, as pendências abertas e marque ciência das críticas antes de clicar em Assumir turno. Quando não houver entrega anterior, o início também fica registrado. O indicador no topo mostra a confirmação.',size:'wide'}]:[]),
      {tab:'overview',selector:'#sessionIdentity',title:'Identificação do usuário',text:'Confira sua conta autenticada no topo. O MOP registra automaticamente quem criou ou atualizou informações. Use sempre seu próprio acesso; as permissões dependem do perfil atribuído.',size:'wide'},
      {tab:'records',selector:'[data-tab="records"]',title:'Menu Registros',text:writer?'Pesquise por assunto, protocolo ou condomínio e filtre por status. Abra um registro para acompanhar dados, prioridade, prazo, responsável, anexos e atualizações; as alterações preservam a autoria.':'Pesquise e filtre os registros e abra cada item para consultar detalhes, anexos e atualizações. Seu perfil é de leitura e não altera os dados.',size:'wide'},
      ...(writer?[{tab:'handover',selector:'[data-tab="handover"]',title:'Menu Passagem de turno',text:'Confira as pendências e o resumo do turno. No encerramento, prepare a entrega com próximos passos para o operador seguinte. No recebimento, revise as informações e confirme a ciência das pendências críticas.',size:'wide'}]:[]),
      {tab:writer?'handover':'records',selector:writer?'#handover .panel:nth-of-type(2) h2':'#records .panel h2',title:'Histórico e rastreabilidade',text:'O histórico preserva as passagens anteriores, quem entregou e recebeu, datas, observações e retratos das pendências. Dentro de cada registro, use Consultar histórico para revisar eventos e atualizações com autoria.',size:'wide'},
      {tab:'overview',selector:'#mopToolsGroup',expandTools:true,title:'Ferramentas suplementares',text:'Abra Ferramentas na barra lateral para conhecer funções adicionais, como Calendário, E-mails e Lenel. São recursos complementares; algumas integrações estão em modo de simulação e não executam ações externas.',size:'compact'},
      {tab:'about',selector:'#startTutorial',title:'Ajuda disponível quando precisar',text:'Pronto! Você pode repetir esta apresentação em Sobre → Iniciar tutorial guiado. Use as opções da sua conta para encerrar a sessão corretamente antes da troca de operador.',size:'compact'}
    ];
  }
  if(typeof module==='object'&&module.exports){module.exports={version,keyFor,stepsFor};return;}
  const key=()=>keyFor(window.mopAccount||{userId:'anonymous',role:'viewer'});
  const seen=()=>{try{return localStorage.getItem(key())==='done';}catch{return false;}};
  const mark=()=>{try{localStorage.setItem(key(),'done');}catch{}};
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function setupToolsMenu(){
    if(document.getElementById('mopToolsGroup'))return;
    const caption=[...document.querySelectorAll('.sidebar-caption')].find(x=>x.textContent.trim()==='FERRAMENTAS');
    const nav=caption?.nextElementSibling;
    if(!caption||!nav?.classList.contains('tabs'))return;
    const group=document.createElement('details');group.id='mopToolsGroup';group.className='mop-tools-group';
    const summary=document.createElement('summary');summary.id='mopToolsToggle';
    summary.innerHTML='<span>FERRAMENTAS</span>';
    caption.before(group);caption.remove();group.append(summary,nav);
    nav.setAttribute('aria-label','Ferramentas suplementares');
    nav.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{group.open=true;}));
  }
  function selectTarget(step){
    const selector=step.expandTools&&innerWidth<=650?'#mopToolsToggle':step.selector;
    return document.querySelector(selector)||document.querySelector('main section:not(.hidden)');
  }
  async function focusStep(step){
    if(step.tab&&typeof window.tab==='function')window.tab(step.tab);
    if(step.expandTools)document.getElementById('mopToolsGroup')?.setAttribute('open','');
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const target=selectTarget(step);
    if(target){
      // Instant navigation keeps the spotlight aligned even with long histories.
      target.scrollIntoView({behavior:'instant',block:innerWidth<=650?'start':'center',inline:'nearest'});
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    }
    return target;
  }
  function allowedSteps(){
    return stepsFor(window.mopAccount).filter(step=>{
      const nav=document.querySelector('[data-tab="'+step.tab+'"]');
      return nav&&!nav.hidden;
    });
  }
  // Four independently blurred panels leave a sharp opening over the actual feature.
  // Unlike a backdrop-filter on the entire page, this also works for fixed sidebars.
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function spotlightBounds(target){
    if(!target?.isConnected)return null;
    const r=target.getBoundingClientRect(),margin=9;
    const left=clamp(r.left-margin,0,innerWidth),right=clamp(r.right+margin,0,innerWidth);
    const top=clamp(r.top-margin,0,innerHeight),bottom=clamp(r.bottom+margin,0,innerHeight);
    if(right-left<8||bottom-top<8)return null;
    return {left,right,top,bottom,width:right-left,height:bottom-top};
  }
  function paintSpotlight(overlay,target){
    const rect=spotlightBounds(target),vw=innerWidth,vh=innerHeight;
    const boxes=rect?[
      [0,0,vw,rect.top],
      [0,rect.bottom,vw,Math.max(0,vh-rect.bottom)],
      [0,rect.top,rect.left,rect.height],
      [rect.right,rect.top,Math.max(0,vw-rect.right),rect.height]
    ]:[[0,0,vw,vh],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    overlay.querySelectorAll('.tutorial-shade').forEach((shade,i)=>{
      const [x,y,w,h]=boxes[i];
      shade.style.left=x+'px';shade.style.top=y+'px';
      shade.style.width=w+'px';shade.style.height=h+'px';
    });
    const ring=overlay.querySelector('.tutorial-spotlight');
    ring.hidden=!rect;
    if(rect){
      ring.style.left=rect.left+'px';ring.style.top=rect.top+'px';
      ring.style.width=rect.width+'px';ring.style.height=rect.height+'px';
    }
    return rect;
  }
  function place(panel,target,spotlight){
    const vw=innerWidth,vh=innerHeight,margin=12,gap=20;
    const pw=Math.min(panel.offsetWidth||420,vw-2*margin),ph=Math.min(panel.offsetHeight||290,vh-2*margin);
    const r=spotlight||spotlightBounds(target)||{left:vw/2-20,top:vh/2-20,right:vw/2+20,bottom:vh/2+20};
    const centerX=(r.left+r.right-pw)/2,centerY=(r.top+r.bottom-ph)/2;
    const candidates=[
      {side:'right',x:r.right+gap,y:centerY},
      {side:'left',x:r.left-pw-gap,y:centerY},
      {side:'bottom',x:centerX,y:r.bottom+gap},
      {side:'top',x:centerX,y:r.top-ph-gap},
      {side:'dock-bottom',x:(vw-pw)/2,y:vh-ph-margin},
      {side:'dock-top',x:(vw-pw)/2,y:margin}
    ];
    const area=(x,y)=>{
      const dx=Math.max(0,Math.min(x+pw,r.right)-Math.max(x,r.left));
      const dy=Math.max(0,Math.min(y+ph,r.bottom)-Math.max(y,r.top));
      return dx*dy;
    };
    const rated=candidates.map((c,i)=>{
      const x=clamp(c.x,margin,Math.max(margin,vw-pw-margin));
      const y=clamp(c.y,margin,Math.max(margin,vh-ph-margin));
      const shift=Math.abs(x-c.x)+Math.abs(y-c.y);
      return {...c,x,y,score:area(x,y)*20+shift*3+i*4};
    }).sort((a,b)=>a.score-b.score);
    const best=rated[0];
    panel.style.setProperty('--tutorial-x',Math.round(best.x)+'px');
    panel.style.setProperty('--tutorial-y',Math.round(best.y)+'px');
    panel.dataset.placement=best.side;
  }
  async function show(force=false){
    setupToolsMenu();
    if(!window.mopAccount?.userId||document.querySelector('.tutorial-panel')||(!force&&seen()))return;
    const steps=allowedSteps();if(!steps.length)return;
    const group=document.getElementById('mopToolsGroup'),initiallyOpen=!!group?.open;
    const originalTab=document.querySelector('main section:not(.hidden)')?.id||'overview';
    let index=0,target=null,rendering=false;
    const overlay=document.createElement('div');overlay.className='tutorial-overlay';overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML='<div class="tutorial-shade"></div><div class="tutorial-shade"></div><div class="tutorial-shade"></div><div class="tutorial-shade"></div><div class="tutorial-spotlight" hidden></div>';
    const panel=document.createElement('aside');panel.className='tutorial-panel';
    panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','tutorialTitle');
    panel.innerHTML='<div class="tutorial-card"><div class="tutorial-head"><div><p class="eyebrow">PRIMEIRO ACESSO · MOP PREVIEW</p><h2 id="tutorialTitle"></h2></div><button id="tutorialClose" type="button" aria-label="Encerrar tutorial">×</button></div><p id="tutorialText" aria-live="polite"></p><div class="tutorial-step-track" aria-hidden="true"><span id="tutorialBar"></span></div><div class="tutorial-progress"><span id="tutorialCount"></span><div><button id="tutorialPrev" type="button">Voltar</button><button id="tutorialNext" class="primary" type="button">Próximo</button></div></div><button id="tutorialSkip" class="quiet" type="button">Pular apresentação</button></div>';
    document.body.append(overlay,panel);
    const heading=panel.querySelector('#tutorialTitle'),description=panel.querySelector('#tutorialText');
    const count=panel.querySelector('#tutorialCount'),prev=panel.querySelector('#tutorialPrev'),next=panel.querySelector('#tutorialNext'),bar=panel.querySelector('#tutorialBar');
    function releaseTarget(){
      if(target)target.classList.remove('tutorial-target');
    }
    let raf=0;
    const updatePosition=()=>{
      if(!panel.isConnected)return;
      const rect=paintSpotlight(overlay,target);
      place(panel,target,rect);
    };
    const requestPosition=()=>{
      if(raf)cancelAnimationFrame(raf);
      raf=requestAnimationFrame(()=>{raf=0;updatePosition();});
    };
    async function render(){
      if(rendering||!panel.isConnected)return;
      rendering=true;prev.disabled=true;next.disabled=true;releaseTarget();
      try{
        const step=steps[index];
        target=await focusStep(step);
        if(!panel.isConnected)return;
        heading.textContent=step.title;description.textContent=step.text;
        count.textContent='Etapa '+(index+1)+' de '+steps.length;
        bar.style.width=(100*(index+1)/steps.length)+'%';
        panel.dataset.size=step.size||'wide';
        next.textContent=index===steps.length-1?'Concluir':'Próximo';
        if(target)target.classList.add('tutorial-target');
        await new Promise(resolve=>requestAnimationFrame(resolve));
        updatePosition();
      }finally{rendering=false;prev.disabled=index===0;next.disabled=false;}
    }
    const onResize=()=>{
      requestAnimationFrame(()=>{
        const active=steps[index],adjusted=active?selectTarget(active):null;
        if(adjusted&&adjusted!==target){releaseTarget();target=adjusted;target.classList.add('tutorial-target');}
        if(target?.isConnected){
          const r=target.getBoundingClientRect();
          if(r.bottom<8||r.top>innerHeight-8||innerWidth<=650)target.scrollIntoView({behavior:'instant',block:innerWidth<=650?'start':'nearest',inline:'nearest'});
        }
        requestPosition();
      });
    };
    const onScroll=()=>requestPosition();
    const onKey=event=>{
      if(event.key==='Escape'){event.preventDefault();finish();}
      if(event.key==='ArrowRight'&&!rendering){event.preventDefault();advance();}
      if(event.key==='ArrowLeft'&&!rendering&&index>0){event.preventDefault();index--;render();}
      if(event.key==='Tab'){
        const controls=[...panel.querySelectorAll('button:not([disabled])')];
        const first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    function finish(){
      releaseTarget();overlay.remove();panel.remove();mark();
      if(group&&!initiallyOpen)group.open=false;
      if(raf)cancelAnimationFrame(raf);
      removeEventListener('resize',onResize);removeEventListener('keydown',onKey);
      removeEventListener('scroll',onScroll,true);
      if(typeof window.tab==='function')window.tab(originalTab==='about'?'about':'overview');
    }
    function advance(){if(rendering)return;if(index===steps.length-1)finish();else{index++;render();}}
    prev.onclick=()=>{if(!rendering&&index>0){index--;render();}};
    next.onclick=advance;panel.querySelector('#tutorialSkip').onclick=finish;panel.querySelector('#tutorialClose').onclick=finish;
    addEventListener('resize',onResize);addEventListener('keydown',onKey);
    addEventListener('scroll',onScroll,true);
    await render();next.focus({preventScroll:true});
  }
  window.MOPTutorial={show,seen,steps:allowedSteps,setupToolsMenu};
})();