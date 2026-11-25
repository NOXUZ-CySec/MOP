'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const analytic=require('../desktop/report-analytics106.cjs');
const reports=require('../desktop/report-export105.cjs');
const {Store}=require('../desktop/store.cjs');
const NOW=Date.parse('2026-11-21T15:00:00.000Z'),D=86400000;
const event=(id,day,opts={})=>({id,protocol:'MOP-'+id,created_at:new Date(NOW-day*D).toISOString(),condo:opts.condo||'CEA',category:opts.category||'Segurança',status:opts.status||'Pendente',subject:opts.subject||'Câmera sem sinal',description:'Exemplo de registro',updated_at:new Date(NOW-day*D).toISOString()});
const data=[event(1,0.5),event(2,1.5),event(3,5,{subject:'Câmera sem sinal'}),event(4,8),event(5,9,{condo:'RESTRITO'}),event(6,30),event(7,50,{category:'Rotina'}),event(8,68)];
test('Comparison uses two matching 7-day windows without losing older boundary records',()=>{const r=analytic.analyze(data,{days:7,now:NOW});assert.equal(r.currentCount,3);assert.equal(r.previousCount,2);assert.equal(r.metrics.find(x=>x.type==='all').delta,1);assert.equal(r.series.reduce((sum,x)=>sum+x.count,0),3)});
test('Filters preserve condominium and category separation',()=>{const r=analytic.analyze(data,{days:30,now:NOW,condo:'CEA',category:'Segurança'});assert.equal(r.currentCount,5);assert.equal(r.previousCount,0);assert.ok(r.recurrence.every(x=>x.condo==='CEA'))});
test('Recurrence normalizes punctuation and accents but requires same condominium',()=>{const r=analytic.analyze([event(1,0.2,{subject:'CÂMERA - SEM SINAL'}),event(2,0.5,{subject:'camera sem sinal'}),event(3,0.6,{condo:'OUTRA'})],{days:7,now:NOW});assert.equal(r.recurrence.length,1);assert.equal(r.recurrence[0].count,2)});
test('No percentage claimed when previous period is empty',()=>{const r=analytic.analyze([event(1,0.5)],{days:7,now:NOW});assert.equal(r.metrics[0].percent,null);assert.equal(r.metrics[0].delta,1)});
test('Comparative export preserves scope and creates detail sheets',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop106-')),store=new Store(dir);
 try{
 const state=store.read();state.items=data.map((x,i)=>({...x,id:i+1}));state.nextItem=state.items.length+1;store.write(state);
 const session={userId:'sup',role:'supervisor',display_name:'Supervisor',condos:['CEA']};
 const report=reports.createData(store,session,{section:'analytics',days:30,period:'Todos os períodos',condo:'CEA',category:'Todas as categorias',status:'Todos os status'});
 assert.equal(report.days,30);const enriched=await reports.enrichReport(report,store,null,session);
 assert.equal(enriched.section,'analytics');assert.equal(enriched.headings.length,4);
 assert.ok(enriched.analytics.recurrence.every(x=>x.condo==='CEA'));
 const bytes=await reports.sheets(enriched).xlsx.writeBuffer();const book=new (require('exceljs').Workbook)();await book.xlsx.load(bytes);
 assert.ok(book.getWorksheet('Recorrências'));assert.ok(book.getWorksheet('Série diária'));
 assert.ok(!JSON.stringify(enriched.rows).includes('RESTRITO'));
 assert.match(reports.html(enriched),/históricos|históric/);
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true})}
});
