'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
(async()=>{await app.whenReady();let win;try{
 const dir=path.join(__dirname,'../ui-next/dist/assets'),name=fs.readdirSync(dir).find(n=>n.endsWith('.css'));
 const css=fs.readFileSync(path.join(dir,name),'utf8');
 const html='<html><style>'+css+'</style><div class="ref-app"><div class="mop-page47"><section class="scale-screen scale70"><div class="scale70-calendar-anchor"><div class="scale70-grid"><button id="normal" class="scale-day work"><span class="scale-day-head">5</span><span class="scale-day-main">Plantão</span></button><button id="work" class="scale-day work scale70-selected"><span class="scale-day-head">6</span><span class="scale-day-main">Plantão</span></button><button id="off" class="scale-day off scale70-selected"><span class="scale-day-head">7</span><span class="scale-day-main">Folga</span></button><button id="vacation" class="scale-day vacation scale70-selected"><span class="scale-day-head">8</span><span class="scale-day-main">Férias</span></button></div></div></section></div></div></html>';
 win=new BrowserWindow({show:false,width:1000,height:500,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
 await win.loadURL('data:text/html;charset=utf-8;base64,'+Buffer.from(html).toString('base64'));
 const r=await win.webContents.executeJavaScript("(()=>{let ids=['normal','work','off','vacation'];return Object.fromEntries(ids.map(id=>{const e=document.getElementById(id),c=getComputedStyle(e),lab=getComputedStyle(e.querySelector('.scale-day-main'));return[id,{bg:c.backgroundImage,color:c.color,border:c.borderTopColor,borderWidth:c.borderTopWidth,label:lab.color}] }))})()");
 console.log(JSON.stringify(r,null,2));
 for(const id of ['work','off','vacation']){if(!r[id].bg.includes('rgba(24, 116, 165, 0.98)')||r[id].borderWidth!=='2px'||r[id].bg===r.normal.bg)throw Error('Selection not visible: '+id)}
 console.log('ELECTRON PASSED: selected Plantão, Folga, Férias visibly blue and distinct from normal');app.exit(0);
}catch(e){console.error(e.stack||e);app.exit(1)}finally{win?.destroy()}})();