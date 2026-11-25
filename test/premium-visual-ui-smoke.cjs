'use strict';
// Extend the real operator workflow with rendered premium regression checks.
// The underlying harness uses a temporary profile and a fake cloud client.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const original=path.join(__dirname,'operator-shift-ui-smoke.cjs');
let source=fs.readFileSync(original,'utf8');
const gateMarker=" if(!process.env.MOP_EMPTY_SHIFT){await js(";
const gateChecks=`
 const gateStyle=await js(\`(()=>{
   const d=document.querySelector('dialog:has(#shiftGateAccept)');
   const cs=s=>getComputedStyle(d.querySelector(s));
   const rgb=s=>s.match(/[0-9]+/g).slice(0,3).map(Number);
   const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
   const contrast=(a,b)=>{a=lum(rgb(a));b=lum(rgb(b));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
   const label=d.querySelector('.critical-list label');
   return {background:getComputedStyle(d).backgroundColor,gate:cs('.shift-gate').backgroundColor,
     textContrast:contrast(cs('.shift-gate-last').color,cs('.shift-gate').backgroundColor),
     criticalContrast:label?contrast(cs('.critical-list strong').color,getComputedStyle(label).backgroundColor):10,
     checkbox:label?cs('input[type=checkbox]').accentColor:null,
     bodyOverflow:cs('.release-body').overflowY};
 })()\`);
 assert.equal(gateStyle.background,'rgb(11, 28, 48)');
 assert.equal(gateStyle.gate,'rgb(16, 36, 58)');
 assert.ok(gateStyle.textContrast>=4.5,JSON.stringify(gateStyle));
 assert.ok(gateStyle.criticalContrast>=4.5,JSON.stringify(gateStyle));
 assert.equal(gateStyle.bodyOverflow,'auto');
 if(!process.env.MOP_EMPTY_SHIFT)assert.equal(gateStyle.checkbox,'rgb(96, 186, 255)');
 console.log('PREMIUM_RECEIPT_OK '+JSON.stringify(gateStyle));
`;
if(!source.includes(gateMarker))throw Error('Operator harness gate marker changed');
source=source.replace(gateMarker,gateChecks+gateMarker);
const endMarker=" console.log('OPERATOR_SHIFT_UI_OK '";
const notificationChecks=`
 win.setMinimumSize(320,400);
 for(const [width,height] of [[1366,900],[800,700],[390,700]]){
   win.setSize(width,height);
   await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
   const result=await js(\`(()=>{
     const panel=document.querySelector('#notificationPanel');panel.hidden=false;
     document.querySelector('#recentNotifications').innerHTML='<article class="personal-notice"><h3>Teste visual</h3><p>Conteudo de teste</p></article>'.repeat(30);
     const r=panel.getBoundingClientRect(),p=getComputedStyle(panel),h=getComputedStyle(document.querySelector('.topbar'));
     const target=document.elementFromPoint(r.left+20,Math.min(r.bottom-20,r.top+260));
     panel.scrollTop=100;const panelScrolled=panel.scrollTop>0;
     window.scrollTo(0,200);const after=panel.getBoundingClientRect();
     const result={width:innerWidth,height:innerHeight,left:r.left,right:r.right,top:r.top,bottom:r.bottom,overlay:panel.contains(target),panelScrolled,fixed:Math.abs(after.top-r.top)<1,backdrop:h.backdropFilter,background:p.backgroundColor};
     window.scrollTo(0,0);panel.hidden=true;return result;
   })()\`);
   assert.ok(result.left>=0&&result.right<=result.width&&result.top>=0&&result.bottom<=result.height,JSON.stringify(result));
   assert.ok(result.overlay&&result.panelScrolled&&result.fixed,JSON.stringify(result));
   assert.equal(result.backdrop,'none');
   assert.equal(result.background,'rgb(13, 32, 52)');
   console.log('PREMIUM_NOTIFICATIONS_OK '+JSON.stringify(result));
 }
`;
if(!source.includes(endMarker))throw Error('Operator harness end marker changed');
source=source.replace(endMarker,notificationChecks+endMarker);
const harness=new Module(original,module);harness.filename=original;harness.paths=module.paths;harness._compile(source,original);
