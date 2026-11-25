'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
(async()=>{await app.whenReady();let win;try{
 const dir=path.join(__dirname,'../ui-next/dist/assets'),name=fs.readdirSync(dir).find(s=>s.endsWith('.css'));
 const css=fs.readFileSync(path.join(dir,name),'utf8');
 const html='<html><style>'+css+'</style><div class="ref-app"><div class="mop-page47">'+
 '<div class="records-screen"><button class="records-row" id="records">Registro</button></div>'+
 '<div class="mop-home54"><button class="mop-home109-briefing-item" id="urgent">Ocorrência</button><button class="mop-home109-briefing-item" id="routine">Rotina</button><button class="mop-home54-pending" id="pending">Pendente</button></div>'+
 '<div class="handover-screen"><div class="handover-item"><button class="handover-item-summary" id="handover">Passagem de Turno</button></div></div></div></div></html>';
 win=new BrowserWindow({show:false,width:1000,height:700,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
 await win.loadURL('data:text/html;charset=utf-8;base64,'+Buffer.from(html).toString('base64'));
 const debuggerSession=win.webContents.debugger;debuggerSession.attach('1.3');
 await debuggerSession.sendCommand('DOM.enable');await debuggerSession.sendCommand('CSS.enable');
 const root=await debuggerSession.sendCommand('DOM.getDocument');const result={};
 for(const id of ['records','urgent','routine','pending','handover']){
 const node=await debuggerSession.sendCommand('DOM.querySelector',{nodeId:root.root.nodeId,selector:'#'+id});
 await debuggerSession.sendCommand('CSS.forcePseudoState',{nodeId:node.nodeId,forcedPseudoClasses:['hover']});
 result[id]=await win.webContents.executeJavaScript(`(()=>{const c=getComputedStyle(document.getElementById('${id}'));return {bg:c.backgroundColor,radius:c.borderRadius}})()`);
 await debuggerSession.sendCommand('CSS.forcePseudoState',{nodeId:node.nodeId,forcedPseudoClasses:[]});
 }
 console.log(JSON.stringify(result,null,2));
 for(const id of ['urgent','routine','pending','handover'])if(result[id].bg!==result.records.bg)throw Error(id+' differs from Records hover: '+result[id].bg+' vs '+result.records.bg);
 console.log('ELECTRON PASSED: CSS hover force matches Records across Home and Handover');app.exit(0);
}catch(e){console.error(e.stack||e);app.exit(1)}finally{win?.destroy()}})();