'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
(async()=>{await app.whenReady();let win;try{
 const assetDir=path.join(__dirname,'../ui-next/dist/assets'),name=fs.readdirSync(assetDir).find(n=>n.endsWith('.css'));
 const css=fs.readFileSync(path.join(assetDir,name),'utf8');
 const html='<html><style>'+css+'</style><style>.ref-app .mop-page47 .scale70{position:relative}.scale70-toolbar{position:relative!important;top:120px;height:90px}.scale96-identity{height:40px}.scale-overlay{display:grid!important}.scale-dialog{width:400px;height:250px}</style><div class="ref-app"><main class="mop-page47"><div class="scale-screen scale70"><div class="scale70-toolbar scale96-manager-toolbar" id="toolbar"><div class="scale96-identity" id="collaborator">João · Colaborador</div></div><div class="scale-overlay" id="overlay"><form class="scale-dialog" role="dialog" aria-modal="true" id="dialog"><h2>Solicitar troca</h2><button type="button" id="action">Confirmar</button></form></div></div></main></div></html>';
 win=new BrowserWindow({show:false,width:1200,height:780,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
 await win.loadURL('data:text/html;charset=utf-8;base64,'+Buffer.from(html).toString('base64'));
 const x=await win.webContents.executeJavaScript("(()=>{const toolbar=document.getElementById('collaborator'),dialog=document.getElementById('dialog'),rect=toolbar.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2,hit=document.elementFromPoint(x,y);return{toolbarZ:getComputedStyle(document.getElementById('toolbar')).zIndex,overlayZ:getComputedStyle(document.getElementById('overlay')).zIndex,hit:hit?.id||hit?.className,dialogInFront:dialog.contains(hit)||document.getElementById('overlay').contains(hit),point:[x,y]}})()");
 console.log(JSON.stringify(x,null,2));if(!x.dialogInFront||Number(x.overlayZ)<=Number(x.toolbarZ))throw Error('Header still overlaps dialog');console.log('ELECTRON PASSED: collaborator remains behind modal');app.exit(0)
}catch(e){console.error(e.stack||e);app.exit(1)}finally{win?.destroy()}})();
