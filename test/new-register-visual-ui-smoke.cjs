'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const original=path.join(__dirname,'demo-roles-ui-smoke.cjs');
const source=fs.readFileSync(original,'utf8'),marker="    console.log('DEMO_ROLE_UI_OK '+";
if(!source.includes(marker))throw Error('Role harness marker changed');
const checks=`
    console.log('UI_STEP before tab');await js("tab('new')");console.log('UI_STEP after tab');
    await until(()=>js("!document.querySelector('#new').classList.contains('hidden')"));
    console.log('UI_STEP before details');const details=await js(\`(()=>{
      const form=document.querySelector('#newForm'),groups=[...form.querySelectorAll('.optional-fields > details')];
      const subject=document.querySelector('#field-7'),priority=document.querySelector('#field-6'),description=document.querySelector('#field-11'),condo=document.querySelector('#field-3');
      const summary=groups[0].querySelector('summary'),arrow=getComputedStyle(summary,'::after'),sel=getComputedStyle(priority),border=getComputedStyle(groups[0]).borderColor;
      return {groups:groups.length,allClosed:groups.every(x=>!x.open),subject:subject.required,description:description.required,condo:condo.required,priority:priority.value,core:!!subject.closest('.new-core-grid'),border,arrowTop:arrow.top,arrowPosition:arrow.position,summaryHeight:summary.getBoundingClientRect().height,selectAppearance:sel.appearance,selectBg:sel.backgroundImage,saveLabel:form.querySelector('#saveRecord')?.textContent.trim()};
    })()\`);
    console.log('NEW_FORM_DIAGNOSTIC',JSON.stringify(details));assert.equal(details.groups,3);assert.ok(details.allClosed&&details.core&&details.subject&&details.description&&details.condo);
    assert.equal(details.priority,'Normal');assert.equal(details.saveLabel,'Salvar registro');
    assert.equal(details.arrowPosition,'absolute');
    assert.ok(Math.abs(parseFloat(details.arrowTop)-details.summaryHeight/2)<2.1,JSON.stringify(details));
    assert.equal(details.selectAppearance,'none');assert.ok(details.selectBg.includes('svg'),JSON.stringify(details));
    assert.ok(details.border!=='rgb(255, 255, 255)'&&details.border!=='rgb(227, 233, 240)',JSON.stringify(details));
    console.log('NEW_REGISTER_DEFAULT_OK '+JSON.stringify(details));
    for(const [w,h] of [[1440,900],[1024,768],[800,650],[390,700]]){
      win.setMinimumSize(320,400);win.setSize(w,h);await new Promise(r=>setTimeout(r,250));
      const view=await js(\`(()=>{
        const form=document.querySelector('#newForm'),c=document.querySelector('.new-core-grid').getBoundingClientRect(),subject=document.querySelector('.new-subject').getBoundingClientRect(),priority=document.querySelector('.new-priority').getBoundingClientRect(),details=document.querySelector('.optional-fields>details').getBoundingClientRect(),panel=document.querySelector('#new>.panel').getBoundingClientRect();
        const select=form.querySelector('select'),css=getComputedStyle(select),summary=form.querySelector('.optional-fields>details>summary'),sr=summary.getBoundingClientRect(),a=getComputedStyle(summary,'::after');
        return {width:innerWidth,panelRight:panel.right,subjectRight:subject.right,priorityRight:priority.right,detailsRight:details.right,coreWidth:c.width,sideBySide:Math.abs(subject.top-priority.top)<12,arrowDelta:Math.abs(parseFloat(a.top)-sr.height/2),selectBg:css.backgroundImage};
      })()\`);
      assert.ok(view.panelRight<=view.width+1&&view.subjectRight<=view.width+1&&view.priorityRight<=view.width+1&&view.detailsRight<=view.width+1,'Overflow: '+JSON.stringify(view));
      assert.equal(view.sideBySide,w>700,'Grid layout: '+JSON.stringify(view));
      assert.ok(view.arrowDelta<2.1&&view.selectBg.includes('svg'),'Chevron alignment: '+JSON.stringify(view));
      console.log('NEW_REGISTER_RESOLUTION_OK '+w+'x'+h);
    }
    await js("document.querySelector('.optional-fields>details').open=true");
    const expanded=await js(\`(()=>{
      const d=document.querySelector('.optional-fields>details'),s=d.querySelector('summary'),a=getComputedStyle(s,'::after'),border=getComputedStyle(d).borderColor;return {open:d.open,arrowTop:a.top,summaryHeight:s.getBoundingClientRect().height,border,fields:[...d.querySelectorAll('input')].map(x=>x.name)};
    })()\`);
    assert.ok(expanded.open&&expanded.fields.includes('company')&&expanded.fields.includes('source'));
    assert.ok(Math.abs(parseFloat(expanded.arrowTop)-expanded.summaryHeight/2)<2.1,JSON.stringify(expanded));
    assert.notEqual(expanded.border,'rgb(255, 255, 255)');
    console.log('NEW_REGISTER_EXPANSION_OK '+JSON.stringify(expanded));
    win.setSize(1280,800);
`;
const mod=new Module(original,module);mod.filename=original;mod.paths=module.paths;mod._compile(source.replace(marker,checks+marker),original);
