'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
(async()=>{await app.whenReady();let win;try{
 const assets=path.join(__dirname,'../ui-next/dist/assets'),name=fs.readdirSync(assets).find(s=>s.endsWith('.css'));
 const css=fs.readFileSync(path.join(assets,name),'utf8');
 const html='<html><style>'+css+'</style><div class="ref-app mop-premium47"><div class="mop-page47"><div class="mop-home54"><div class="mop-home109-briefing" id="orientation">Orientação</div><div class="records-metrics mop-home58-metrics">'+['blue','green','amber','red'].map((tone,i)=>'<div id="metric'+i+'" class="records-metric '+tone+'"><div class="records-metric-icon">•</div>Índice '+i+'</div>').join('')+'</div><section id="continuity" class="mop-home62-continuity">Continuidade operacional</section><div id="reference" class="mop-home54-panel">Acontecimentos</div></div></div></div></html>';
 win=new BrowserWindow({show:false,width:1300,height:700,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
 await win.loadURL('data:text/html;charset=utf-8;base64,'+Buffer.from(html).toString('base64'));
 const res=await win.webContents.executeJavaScript("(()=>{const names=['metric0','metric1','metric2','metric3','continuity','reference','orientation'];return Object.fromEntries(names.map(n=>{let s=getComputedStyle(document.getElementById(n));return[n,{background:s.backgroundImage,border:s.borderTopColor,blur:s.backdropFilter,shadow:s.boxShadow}]}))})()");
 console.log(JSON.stringify(res,null,2));
 for(const n of ['metric0','metric1','metric2','metric3','continuity']){if(res[n].background!==res.reference.background||res[n].blur!==res.reference.blur||res[n].border!==res.reference.border)throw Error(n+' differs from baseline reference');}
 console.log('ELECTRON PASSED: all four metric cards and continuity match approved panel surface.');app.exit(0)
}catch(e){console.error(e.stack||e);app.exit(1)}finally{win?.destroy()}})();
