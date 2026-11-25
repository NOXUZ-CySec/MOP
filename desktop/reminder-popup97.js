'use strict';
window.mopReminder.onTask(data=>{
 document.getElementById('title').textContent=data.title;
 const readable=(/^\d{4}-\d{2}-\d{2}$/.test(data.date||''))?data.date.split('-').reverse().join('/'):String(data.date||'');
 document.getElementById('time').textContent=(data.isTest?'Prévia de notificação · ':'Agendada para ')+data.time+' · '+readable;
});
const buttons=[...document.querySelectorAll('button')];
const execute=async(action)=>{
 buttons.forEach(x=>x.disabled=true);
 try{
  const result=await window.mopReminder.respond(action);
  if(!result?.ok)throw Error(result?.error||'Falha ao registrar resposta.');
  window.close();
 }catch(error){
  document.getElementById('error').textContent=error.message;
  buttons.forEach(x=>x.disabled=false);
 }
};
for(const [id,action] of [['later','snooze'],['dismiss','dismiss'],['done','complete'],['close','dismiss']]){
 document.getElementById(id).addEventListener('click',()=>execute(action));
}