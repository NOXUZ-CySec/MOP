'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const original=path.join(__dirname,'operator-shift-ui-smoke.cjs');
let source=fs.readFileSync(original,'utf8');
const marker=" console.log('OPERATOR_SHIFT_UI_OK '+";
if(!source.includes(marker))throw Error('Marker changed in operator smoke test');
const checks=`
 await until(()=>js(\`!!document.querySelector('.tutorial-panel')\`));
 for(const [w,h] of [[1440,900],[1024,768],[800,650],[390,700],[320,500]]){
   win.setMinimumSize(300,380);win.setSize(w,h);
   await new Promise(r=>setTimeout(r,240));
   const view=await js(\`(()=>{
      const panel=document.querySelector('.tutorial-panel'),p=panel.getBoundingClientRect();
      const ring=document.querySelector('.tutorial-spotlight'),s=ring.getBoundingClientRect();
      const shade=document.querySelector('.tutorial-shade'),css=getComputedStyle(shade);
      const overlap=Math.max(0,Math.min(p.right,s.right)-Math.max(p.left,s.left))*Math.max(0,Math.min(p.bottom,s.bottom)-Math.max(p.top,s.top));
      return {width:innerWidth,height:innerHeight,panel:{left:p.left,top:p.top,right:p.right,bottom:p.bottom},spotlight:{left:s.left,top:s.top,right:s.right,bottom:s.bottom,hidden:ring.hidden},blur:css.backdropFilter,overlap,background:getComputedStyle(panel).backgroundColor};
   })()\`);
   assert.ok(view.panel.left>=-1&&view.panel.top>=-1&&view.panel.right<=view.width+1&&view.panel.bottom<=view.height+1,JSON.stringify(view));
   assert.notEqual(view.blur,'none',JSON.stringify(view));assert.equal(view.spotlight.hidden,false,JSON.stringify(view));
   assert.ok(view.overlap<1200,'Popup cobre destaque: '+JSON.stringify(view));
   console.log('TUTORIAL_LAYOUT_OK '+w+'x'+h+' '+JSON.stringify({placement:view.panel,overlap:view.overlap}));
 }
 win.setSize(1280,800);
 const headings=['1. Aceite da passagem de turno','Identificação do usuário','Menu Registros','Menu Passagem de turno','Histórico e rastreabilidade','Ferramentas suplementares','Ajuda disponível quando precisar'];
 for(let i=0;i<headings.length;i++){
   await until(()=>js(\`document.querySelector('#tutorialTitle')?.textContent===\${JSON.stringify(headings[i])}&&!document.querySelector('#tutorialNext')?.disabled\`));
   if(i===5)assert.equal(await js(\`document.querySelector('#mopToolsGroup')?.open\`),true);
   const target=await js(\`!!document.querySelector('.tutorial-spotlight:not([hidden])')\`);
   if(!target)console.log('MISSING_SPOTLIGHT_DIAG',await js("(()=>{const t=document.querySelector('#handover .panel:nth-of-type(2) h2');return {target:!!t,rect:t?.getBoundingClientRect().toJSON(),innerWidth,innerHeight,scrollY};})()"));assert.equal(target,true,'No spotlight at '+headings[i]);
   console.log('TUTORIAL_STEP_OK '+(i+1)+' '+headings[i]);
   for(const [w,h] of [[390,700],[320,500]]){
     win.setSize(w,h);await new Promise(r=>setTimeout(r,320));
     const g=await js(\`(()=>{const a=document.querySelector('.tutorial-panel').getBoundingClientRect(),b=document.querySelector('.tutorial-spotlight').getBoundingClientRect();return {vw:innerWidth,vh:innerHeight,p:[a.left,a.top,a.right,a.bottom],s:[b.left,b.top,b.right,b.bottom],hidden:document.querySelector('.tutorial-spotlight').hidden,overlap:Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top))};})()\`);
     assert.ok(!g.hidden&&g.p[0]>=-1&&g.p[1]>=-1&&g.p[2]<=g.vw+1&&g.p[3]<=g.vh+1&&g.overlap<1200,headings[i]+' '+JSON.stringify(g));
     console.log('TUTORIAL_SMALL_OK '+(i+1)+' '+w+'x'+h);
   }
   win.setSize(1280,800);await new Promise(r=>setTimeout(r,250));
   await js(\`document.querySelector('#tutorialNext').click()\`);
 }
 await until(()=>js(\`!document.querySelector('.tutorial-panel')\`));
 assert.equal(await js(\`MOPTutorial.seen()\`),true);
 console.log('TUTORIAL_RESPONSIVE_UI_OK');
`;
source=source.replace(marker,checks+marker);
const harness=new Module(original,module);harness.filename=original;harness.paths=module.paths;harness._compile(source,original);
