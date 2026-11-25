'use strict';
(() => {
  const status=document.getElementById('overview20Receipt');
  if(!status)return;
  function update(){
    const accepted=Boolean(window.MOPShiftGate?.allowed?.());
    status.textContent=accepted?'Recebimento confirmado · turno ativo':'Recebimento pendente · confirme antes de operar';
    status.parentElement.dataset.accepted=String(accepted);
  }
  const observer=new MutationObserver(update);
  const original=document.getElementById('shiftReceipt');
  if(original)observer.observe(original,{childList:true,subtree:true,characterData:true});
  document.addEventListener('click',event=>{if(event.target.closest('[data-tab="overview"],[data-go="overview"]'))queueMicrotask(update)});
  update();
})();
