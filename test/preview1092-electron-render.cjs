'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
(async()=>{await app.whenReady();let win;try{
 const asset=fs.readdirSync(path.join(__dirname,'../ui-next/dist/assets')).find(f=>f.endsWith('.css'));
 const css=fs.readFileSync(path.join(__dirname,'../ui-next/dist/assets',asset),'utf8');
 const html='<html><meta charset="utf-8"><style>'+css+'</style><style>body{margin:0;background:#061827}.ref-app .mop-page47{padding:20px}.check68 .check98-form{height:130px;padding:12px}.check68 .check68-list{height:180px}.check68 .check98-fields{display:grid;grid-template-columns:230px 230px;height:60px}.check68 .check98-fields .check98-field{height:58px;min-height:0}.check68 .record-filter-menu{height:190px}.check68 .record-filter-dropdown .record-filter-trigger{height:36px}</style>'+
 '<div class="ref-app"><div class="mop-page47">'+
 '<section class="check68"><form class="check68-form check98-form" id="form"><div class="check98-fields"><div class="check98-field" id="field"><span>Período</span><div class="record-filter-dropdown is-open"><button class="record-filter-trigger">Todos</button><div class="record-filter-menu" id="menu"><div class="record-filter-option">Todos</div><div class="record-filter-option" id="choice">Diurno</div><div class="record-filter-option">Noturno</div></div></div></div></div></form><div class="check68-list" id="list">Rotinas deste período</div></section>'+
 '<div class="records-screen"><div class="records-metric" id="records-card">KPI</div><div class="records-list" id="records-list">Registros</div><div class="records-detail" id="records-detail">Detalhes</div></div>'+
 '<div class="occ102-list" id="occ">Ocorrências</div><div class="mop-home54-panel" id="home">Início</div></div></div></html>';
 win=new BrowserWindow({show:false,width:1100,height:950,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
 await win.loadURL('data:text/html;charset=utf-8;base64,'+Buffer.from(html).toString('base64'));
 const result=await win.webContents.executeJavaScript(`(()=>{
 const by=id=>document.getElementById(id),data=id=>{const el=by(id),cs=getComputedStyle(el);return {background:cs.backgroundImage!=='none'?cs.backgroundImage:cs.backgroundColor,blur:cs.backdropFilter,z:cs.zIndex,border:cs.borderTopColor}};
 const choice=by('menu').lastElementChild.getBoundingClientRect(),x=choice.left+choice.width/2,y=choice.top+choice.height/2,hit=document.elementFromPoint(x,y);
 return {form:data('form'),list:data('list'),menu:data('menu'),recordsCard:data('records-card'),recordsList:data('records-list'),recordsDetail:data('records-detail'),occ:data('occ'),home:data('home'),hit:hit?.id||hit?.className||'',hitIsMenu:by('menu').contains(hit),coords:{x,y}};
 })()`);
 console.log(JSON.stringify(result,null,2));
 if(!result.hitIsMenu)throw Error('Dropdown rendered behind another layer: '+result.hit);
 if(result.recordsList.background!==result.home.background||result.recordsDetail.background!==result.home.background||result.recordsCard.background==='none')throw Error('Records theme does not match canonical panel style');
 if(!result.recordsList.background.includes('rgba(')||!result.recordsCard.background.includes('rgba('))throw Error('Transparency missing');
 console.log('ELECTRON REAL RENDER: dropdown on top; Records panels and glass opacity match.');
 app.exit(0);
 }catch(e){console.error(e.stack||e);app.exit(1)}finally{win?.destroy()}})();
