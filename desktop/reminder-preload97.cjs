'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('mopReminder',Object.freeze({
 onTask:callback=>ipcRenderer.on('mop:reminder97-show',(_event,payload)=>callback(payload)),
 respond:action=>ipcRenderer.invoke('mop:reminder97-answer',action)
}));