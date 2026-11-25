'use strict';
const {contextBridge,ipcRenderer} = require('electron');
function unwrap(result) {
  if (!result?.ok) throw Error(result?.error || 'Falha na comunicação com o banco local.');
  return result.value;
}
contextBridge.exposeInMainWorld('mopDesktop',Object.freeze({
  notifications:async(action,input)=>unwrap(await ipcRenderer.invoke('mop:notifications',action,input)),
  onAlert:callback=>{const listener=()=>callback();ipcRenderer.on('mop:alert',listener);return ()=>ipcRenderer.removeListener('mop:alert',listener);},
  download:async input=>unwrap(await ipcRenderer.invoke('mop:download',input)),
  startup108:async(action,input)=>unwrap(await ipcRenderer.invoke('mop:startup108',action,input)),
  awareness49:async(action,input)=>unwrap(await ipcRenderer.invoke('mop:awareness49',action,input)),
  handover36:async(action,input)=>unwrap(await ipcRenderer.invoke('mop:handover36',action,input)),
  occurrence103:async(action,input)=>unwrap(await ipcRenderer.invoke('mop:occurrence103',action,input)),
  checklist68:async(action,input)=>unwrap(await ipcRenderer.invoke('mop:checklist68',action,input)),
  home109:async()=>unwrap(await ipcRenderer.invoke('mop:home109')),
  reminderTest97:async()=>unwrap(await ipcRenderer.invoke('mop:reminder97-test')),
  recordAction96:async(action,input)=>unwrap(await ipcRenderer.invoke('mop:record-action96',action,input)),
  reportAnalytics106:async(input)=>unwrap(await ipcRenderer.invoke('mop:report-analytics106',input)),
  reportExport105:async(format,input)=>unwrap(await ipcRenderer.invoke('mop:report-export105',format,input)),
  scheduleExport76:async(input)=>unwrap(await ipcRenderer.invoke('mop:schedule-export76',input)),
  schedule68:async(action,input)=>unwrap(await ipcRenderer.invoke('mop:schedule68',action,input)),
  management:async(action,input)=>unwrap(await ipcRenderer.invoke('mop:management',action,input)),
  recovery83:async(action,input)=>unwrap(await ipcRenderer.invoke('mop:recovery83',action,input)),
  auth:async(action,input)=>{if(!['status','login','logout'].includes(action))throw Error('Ação desconhecida.');return unwrap(await ipcRenderer.invoke('mop:auth-'+action,input));},
  onLocked:callback=>{const listener=()=>callback();ipcRenderer.on('mop:locked',listener);return ()=>ipcRenderer.removeListener('mop:locked',listener);},
  sync:async(action,input)=>{if(!['status','connect','disconnect','now','conflicts','resolve'].includes(action))throw Error('Ação desconhecida.');return unwrap(await ipcRenderer.invoke('mop:sync-'+action,input));},
  onSync:callback=>{const listener=(_event,status)=>callback(status);ipcRenderer.on('mop:sync-status',listener);return ()=>ipcRenderer.removeListener('mop:sync-status',listener);},
  whenShown:async()=>unwrap(await ipcRenderer.invoke('mop:shown')),
  initialize:async()=>unwrap(await ipcRenderer.invoke('mop:initialize')),
  onResume:callback=>{const listener=()=>callback();ipcRenderer.on('mop:resume',listener);return ()=>ipcRenderer.removeListener('mop:resume',listener);},
  read:()=>unwrap(ipcRenderer.sendSync('mop:read')),
  read48:async()=>unwrap(await ipcRenderer.invoke('mop:read48')),
  write:state=>unwrap(ipcRenderer.sendSync('mop:write',state)),
  createRecord43:async input=>unwrap(await ipcRenderer.invoke('mop:record-create43',input)),
  backup1098:async(action,input)=>{if(!['status','create','verify','restore','open-folder'].includes(action))throw Error('Ação de backup inválida.');return unwrap(await ipcRenderer.invoke('mop:backup1098',action,input));},
  exportData:async()=>unwrap(await ipcRenderer.invoke('mop:export')),
  openData:async()=>unwrap(await ipcRenderer.invoke('mop:open-data')),
  updateNotes:async()=>unwrap(await ipcRenderer.invoke('mop:update-notes')),
    update:async(action)=>{if(!['status','check','install'].includes(action))throw Error('Ação de atualização desconhecida.');return unwrap(await ipcRenderer.invoke('mop:update-'+action));},
  onUpdate:callback=>{const listener=(_event,status)=>callback(status);ipcRenderer.on('mop:update-status',listener);return ()=>ipcRenderer.removeListener('mop:update-status',listener);}
}));

contextBridge.exposeInMainWorld('mopWindow',Object.freeze({
 command:action=>['minimize','maximize','close','status'].includes(action)?ipcRenderer.invoke('mop-next:window-command',action):Promise.reject(Error('Acao invalida')),
 minimize:()=>ipcRenderer.invoke('mop-next:window-command','minimize'),
 maximize:()=>ipcRenderer.invoke('mop-next:window-command','maximize'),
 close:()=>ipcRenderer.invoke('mop-next:window-command','close'),
 status:()=>ipcRenderer.invoke('mop-next:window-command','status')
}));
