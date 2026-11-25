'use strict';
// Preview 92: state-safe update coordinator; Electron-free so its races can be tested.
function createUpdater92({updater,isPackaged,getVersion,notify=()=>{},setDelay=setTimeout,setRepeating=setInterval,privacyMessage=String}){
  let current={state:'idle',version:null,percent:0,message:'Atualizações automáticas prontas.'};
  let initialized=false,pending=null,installing=false;
  const state=()=>({...current,version:current.version||getVersion()});
  const emit=patch=>{current={...current,...patch};notify(state());return state();};
  const resetError=e=>emit({state:'error',message:'Não foi possível verificar atualizações agora: '+privacyMessage(e?.message||'Falha de comunicação.')});
  function configure(){
    if(initialized)return state();
    initialized=true;
    if(!isPackaged)return state();
    updater.setFeedURL({provider:'github',owner:'NOXUZ-CySec',repo:'MOP'});
    updater.autoDownload=true;
    updater.autoInstallOnAppQuit=false;
    updater.allowPrerelease=true;
    updater.channel='preview'; // Preview prereleases only; never switch to stable channel.
    updater.allowDowngrade=false; // Setting channel re-enables downgrades in electron-updater.
    updater.on('checking-for-update',()=>{if(!installing&&current.state!=='ready')emit({state:'checking',message:'Verificando atualizações…'})});
    updater.on('update-available',info=>{if(!installing&&current.state!=='ready')emit({state:'available',version:info.version,message:'Nova versão '+info.version+' encontrada. Download iniciado.'})});
    updater.on('update-not-available',()=>{if(!installing&&current.state!=='ready')emit({state:'current',version:getVersion(),percent:0,message:'Você já está usando a versão mais recente.'})});
    updater.on('download-progress',p=>{if(!installing&&current.state!=='ready')emit({state:'downloading',percent:Math.max(0,Math.min(100,Math.round(p.percent||0))),message:'Baixando atualização… '+Math.round(p.percent||0)+'%'})});
    updater.on('update-downloaded',info=>{if(!installing)emit({state:'ready',version:info.version,percent:100,message:'Atualização '+info.version+' pronta para instalar.'})});
    updater.on('error',error=>{if(!installing&&current.state!=='ready')resetError(error)});
    const task=setDelay(()=>{check().catch(()=>{})},5000);task?.unref?.();
    const timer=setRepeating(()=>{check().catch(()=>{})},6*60*60*1000);timer?.unref?.();
    return state();
  }
  async function check(){
    configure();
    if(!isPackaged)return {...state(),state:'dev',message:'Atualizações disponíveis na versão instalada.'};
    if(installing||['ready','available','downloading'].includes(current.state))return state();
    if(pending)return pending;
    // Promise assigned before the updater's first event is processed: no duplicate requests.
    pending=(async()=>{
      try {emit({state:'checking',message:'Verificando atualizações…'});await updater.checkForUpdates();return state();}
      catch(error){return resetError(error)}
      finally{pending=null}
    })();
    return pending;
  }
  function install(){
    if(!isPackaged||current.state!=='ready'||installing)throw Error('Nenhuma atualização está pronta para instalar.');
    installing=true;
    emit({state:'installing',message:'Encerrando o MOP. A instalação será silenciosa e o aplicativo será reaberto automaticamente.'});
    const timer=setDelay(()=>{
      try{updater.quitAndInstall(true,true)}
      catch(error){installing=false;emit({state:'error',message:'Falha ao iniciar instalação: '+privacyMessage(error?.message||'Instalador indisponível.')})}
    },350);timer?.unref?.();
    return true;
  }
  return {configure,check,install,state};
}
module.exports={createUpdater92};