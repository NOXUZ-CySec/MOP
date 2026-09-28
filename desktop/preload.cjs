'use strict';
const {contextBridge,ipcRenderer} = require('electron');
function unwrap(result) {
  if (!result?.ok) throw Error(result?.error || 'Falha na comunicação com o banco local.');
  return result.value;
}
contextBridge.exposeInMainWorld('mopDesktop',Object.freeze({
  onAlert:callback=>{const listener=()=>callback();ipcRenderer.on('mop:alert',listener);return ()=>ipcRenderer.removeListener('mop:alert',listener);},
  download:async input=>unwrap(await ipcRenderer.invoke('mop:download',input)),
  management:async(action,input)=>unwrap(await ipcRenderer.invoke('mop:management',action,input)),
  auth:async(action,input)=>{if(!['status','login','logout'].includes(action))throw Error('Ação desconhecida.');return unwrap(await ipcRenderer.invoke('mop:auth-'+action,input));},
  onLocked:callback=>{const listener=()=>callback();ipcRenderer.on('mop:locked',listener);return ()=>ipcRenderer.removeListener('mop:locked',listener);},
  sync:async(action,input)=>{if(!['status','connect','disconnect','now','conflicts','resolve'].includes(action))throw Error('Ação desconhecida.');return unwrap(await ipcRenderer.invoke('mop:sync-'+action,input));},
  onSync:callback=>{const listener=(_event,status)=>callback(status);ipcRenderer.on('mop:sync-status',listener);return ()=>ipcRenderer.removeListener('mop:sync-status',listener);},
  whenShown:async()=>unwrap(await ipcRenderer.invoke('mop:shown')),
  initialize:async()=>unwrap(await ipcRenderer.invoke('mop:initialize')),
  onResume:callback=>{const listener=()=>callback();ipcRenderer.on('mop:resume',listener);return ()=>ipcRenderer.removeListener('mop:resume',listener);},
  read:()=>unwrap(ipcRenderer.sendSync('mop:read')),
  write:state=>unwrap(ipcRenderer.sendSync('mop:write',state)),
  exportData:async()=>unwrap(await ipcRenderer.invoke('mop:export')),
  openData:async()=>unwrap(await ipcRenderer.invoke('mop:open-data')),
  update:async(action)=>{if(!['status','check','install'].includes(action))throw Error('Ação de atualização desconhecida.');return unwrap(await ipcRenderer.invoke('mop:update-'+action));},
  onUpdate:callback=>{const listener=(_event,status)=>callback(status);ipcRenderer.on('mop:update-status',listener);return ()=>ipcRenderer.removeListener('mop:update-status',listener);}
}));
