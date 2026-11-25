'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const original=path.join(__dirname,'demo-roles-ui-smoke.cjs');
const source=fs.readFileSync(original,'utf8');
const marker="    console.log('DEMO_ROLE_UI_OK '+";
if(!source.includes(marker))throw Error('Smoke test marker missing');
const checks=`
    await js("tab('handover')");
    await until(()=>js("!!document.querySelector('#handover .compact-pending')"));
    const first=await js(\`(()=>{
      const card=document.querySelector('#handover .compact-pending'),more=document.querySelector('.handover-more-records'),extra=document.querySelector('.handover-extra-data'),summary=document.querySelector('#mopToolsToggle');
      const css=getComputedStyle(card),arrow=getComputedStyle(summary,'::after');
      return {cards:document.querySelectorAll('#handoverItems > .compact-pending').length,more:!!more,moreClosed:more&&!more.open,moreCards:more?.querySelectorAll('.compact-pending').length,extraClosed:extra&&!extra.open,extraDetailsClosed:document.querySelectorAll('.handover-auto-grid details[open]').length===0,
      background:css.backgroundColor,border:css.borderTopColor,meta:!!card.querySelector('.pending-meta'),brief:!!card.querySelector('.pending-brief'),steps:document.querySelectorAll('.handover-history-notes').length,arrowPosition:arrow.position,arrowTop:arrow.top,arrowContent:arrow.content};
    })()\`);
    assert.equal(first.cards,5,'Até cinco registros visíveis inicialmente');
    assert.ok(first.more&&first.moreClosed&&first.moreCards>0,'Mais registros recolhidos');
    assert.ok(first.extraClosed&&first.extraDetailsClosed,'Detalhes adicionais recolhidos');
    assert.ok(first.meta&&first.brief&&first.steps>0,'Hierarquia e histórico preservados');
    assert.notEqual(first.background,'rgb(255, 255, 255)','Cartão sem fundo branco');
    assert.notEqual(first.border,'rgb(255, 255, 255)','Cartão sem borda branca');
    assert.equal(first.arrowPosition,'absolute');assert.ok(parseFloat(first.arrowTop)>=19&&parseFloat(first.arrowTop)<=25);
    console.log('HANDOVER_LAYOUT_DESKTOP_OK '+JSON.stringify(first));
    for(const [w,h] of [[1440,900],[1024,768],[800,650],[390,700]]){
      win.setMinimumSize(320,400);win.setSize(w,h);await new Promise(r=>setTimeout(r,230));
      const res=await js(\`(()=>{
        const card=document.querySelector('#handover .compact-pending'),title=card.querySelector('.pending-head'),tags=card.querySelector('.pending-chips');
        const r=card.getBoundingClientRect(),t=title.getBoundingClientRect(),c=tags.getBoundingClientRect(),sum=document.querySelector('#mopToolsToggle'),sr=sum.getBoundingClientRect();
        const css=getComputedStyle(sum,'::after');
        return {width:innerWidth,height:innerHeight,rect:{left:r.left,right:r.right},titleRight:t.right,tagsRight:c.right,arrowTop:css.top,summaryCenter:sr.height/2,summaryHeight:sr.height};
      })()\`);
      assert.ok(res.rect.left>=-1&&res.rect.right<=res.width+1,'Fora da tela '+JSON.stringify(res));
      assert.ok(res.titleRight<=res.width+1&&res.tagsRight<=res.width+1,'Texto fora da tela '+JSON.stringify(res));
      assert.ok(Math.abs(parseFloat(res.arrowTop)-res.summaryCenter)<2,'Chevron fora do centro: '+JSON.stringify(res));
      console.log('HANDOVER_LAYOUT_RESOLUTION_OK '+w+'x'+h);
    }
    win.setSize(1280,800);
    await js("document.querySelector('.handover-extra-data').open=true;document.querySelector('.handover-more-records').open=true");
    const expanded=await js("(()=>({extra:document.querySelector('.handover-extra-data').open,more:document.querySelector('.handover-more-records').open,counts:document.querySelectorAll('#handoverItems .compact-pending').length}))()");
    assert.ok(expanded.extra&&expanded.more&&expanded.counts>5);
    console.log('HANDOVER_DISCLOSURES_OK '+JSON.stringify(expanded));
`;
const edited=source.replace(marker,checks+marker);
const mod=new Module(original,module);mod.filename=original;mod.paths=module.paths;mod._compile(edited,original);
