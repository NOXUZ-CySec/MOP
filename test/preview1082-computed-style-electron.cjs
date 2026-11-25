'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
(async()=>{await app.whenReady();let win;try{
 const cssName=fs.readdirSync(path.join(__dirname,'../ui-next/dist/assets')).find(s=>s.endsWith('.css'));
 const css=fs.readFileSync(path.join(__dirname,'../ui-next/dist/assets',cssName),'utf8');
 const html='<html><style>'+css+'</style><div class="ref-app"><main class="ref-main"><div class="mop-page47">'+
 '<div class="mop-home54-panel" id="home">Início</div><div class="occ102-list" id="occ">Ocorrências</div><div class="check68-list" id="check">Rotinas</div><div class="audit52-table" id="audit">Auditoria</div>'+
 '<div class="new33-panel" id="records">Registros</div><div class="rep104-panel" id="reports">Relatórios</div><div class="scale70"><div class="scale-panel" id="scale">Escala</div></div>'+
 '<div class="occ102-metric" id="metric">KPI</div><div class="new33-fields"><input id="field" value="Teste"/></div>'+
 '</div></main></div></html>';
 win=new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});
 await win.loadURL('data:text/html;charset=utf-8;base64,'+Buffer.from(html).toString('base64'));
 const result=await win.webContents.executeJavaScript("(()=>{const ids=['home','occ','check','audit','records','reports','scale','metric','field'];return Object.fromEntries(ids.map(id=>{const s=getComputedStyle(document.getElementById(id));return [id,{background:s.backgroundImage!=='none'?s.backgroundImage:s.backgroundColor,blur:s.backdropFilter,border:s.borderTopColor}]}))})()");
 console.log(JSON.stringify(result,null,2));
 const panels=['home','occ','check','audit','records','reports','scale'];
 if(panels.some(x=>result[x].background!==result.home.background))throw Error('Panel background mismatch');
 if(panels.some(x=>!result[x].blur.includes('blur(')))throw Error('Missing real backdrop transparency blur');
 if(!result.metric.background.includes('rgba(')||!result.field.background.includes('rgba('))throw Error('Missing alpha in cards/inputs');
 console.log('VISUAL CSS SMOKE PASSED - consistent computed gradient, opacity and backdrop blur');app.exit(0);
}catch(e){console.error(e.stack||e);app.exit(1)}finally{if(win&&!win.isDestroyed())win.destroy()}})();