'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),H=require('../src/handover-automation.js'),O=require('../desktop/operations.cjs'),{empty}=require('../desktop/store.cjs');
const now=new Date('2026-09-29T18:00:00-03:00'),user={userId:'op',display_name:'Operador',role:'operator',condos:['A']};
const item=(id,extra={})=>({id,protocol:'P'+id,condo:'A',subject:'Registro '+id,status:'Pendente',priority:'Normal',created_at:'2026-09-29T17:00:00-03:00',updated_at:'2026-09-29T17:00:00-03:00',...extra});
const state=rows=>({...empty(),items:rows,nextItem:rows.length+1});
function delivery(s,u=user){return {id:1,automation_version:1,at:now.toISOString(),delivery_slot:'2026-09-29-N',snapshot:s.items,open_ids:JSON.stringify(s.items.map(x=>x.id)),review_token:H.token(s,u),delivery_checklist:H.checklist.map(c=>c.key),incoming:'',receipt_at:null};}
test('passagem: escopo, removidos, resolvidos, top 5 determinístico e não mutação',()=>{
 const s=state(Array.from({length:8},(_,i)=>item(i+1))),before=JSON.stringify(s);s.items.push(item(9,{condo:'B'}),item(10,{deleted_at:'x'}),item(11,{status:'Resolvido'}));
 const p=H.analyze(s,user,now);assert.equal(p.open.length,8);assert.equal(p.top.length,5);assert.deepEqual(p.top.map(x=>x.id),[1,2,3,4,5]);assert.equal(JSON.stringify(state(s.items.slice(0,8))),before);
 assert.deepEqual(H.analyze(s,{...user,condos:[]},now).open,[]);
});
test('passagem: janela inclusiva de 12h, atraso e 60 minutos sem atualização',()=>{
 const s=state([item(1,{deadline:now.toISOString()}),item(2,{deadline:new Date(+now+12*3600000).toISOString()}),item(3,{deadline:new Date(+now+12*3600000+1).toISOString()}),item(4,{deadline:new Date(+now-1).toISOString()}),item(5,{updated_at:new Date(+now-60*60000+1).toISOString()}),item(6,{updated_at:'inválido',created_at:'inválido'})]);
 const p=H.analyze(s,user,now);assert.deepEqual(p.soon.map(x=>x.id),[1,2]);assert.equal(p.counts.overdue,1);assert.equal(p.stale.length,4);assert.equal(p.top[0].id,4);
});
test('passagem: resumo usa período do turno de Brasília e eventos do escopo',()=>{
 const s=state([item(1,{created_at:now.toISOString()}),item(2,{condo:'B',created_at:now.toISOString()})]);s.events=[{id:1,item_id:1,kind:'Atualizado',at:now.toISOString()},{id:2,item_id:2,kind:'Atualizado',at:now.toISOString()}];
 const p=H.analyze(s,user,now);assert.equal(p.counts.created,1);assert.equal(p.counts.updated,1);assert.equal(p.period_start,now.toISOString());assert.deepEqual(H.summary(p).condos,['A']);
});
test('entrega: checklist obrigatório, revisão atual e autoria de sessão em todos os perfis',()=>{
 for(const role of ['operator','supervisor','admin']){const u={...user,role},s=state([item(1)]),next=structuredClone(s);next.handovers=[delivery(s,u)];next.nextHandover=2;
 const saved=O.stampWrite(s,next,u,now.toISOString()).handovers[0];assert.ok(saved.auto_summary.text);assert.ok(saved.delivery_checklist.every(x=>x.user_id===u.userId));assert.equal(saved.review_token,undefined);
 next.handovers[0].delivery_checklist=[];assert.throws(()=>O.stampWrite(s,next,u,now.toISOString()),/checklist/);
 next.handovers[0]=delivery(s,u);next.items[0].updated_at=new Date(+now+1).toISOString();assert.throws(()=>O.stampWrite(s,next,u,now.toISOString()),/mudaram/);
 }
 const s=state([item(1)]),n=structuredClone(s);n.handovers=[delivery(s)];n.nextHandover=2;assert.throws(()=>O.stampWrite(s,n,{...user,role:'viewer'}),/consulta/);
});
test('recebimento: leituras por versão, exceção privilegiada e resumo imutável',()=>{
 const s=state([item(1,{priority:'Urgente'})]),n=structuredClone(s);n.handovers=[delivery(s)];n.nextHandover=2;const delivered=O.stampWrite(s,n,user,now.toISOString()),received=structuredClone(delivered),h=received.handovers[0];
 Object.assign(h,{receipt_at:now.toISOString(),receipt_slot:'2026-09-29-N',critical_protocols:['P1'],read_versions:{P1:'errada'}});
 assert.throws(()=>O.stampWrite(delivered,received,user,now.toISOString()),/versão atual/);
 h.read_versions={P1:s.items[0].updated_at};h.auto_summary={text:'forjado'};const saved=O.stampWrite(delivered,received,user,now.toISOString()).handovers[0];assert.deepEqual(saved.auto_summary,delivered.handovers[0].auto_summary);assert.equal(saved.read_confirmations[0].user_id,user.userId);
 h.read_versions={};h.receipt_override=true;h.receipt_note='Justificativa operacional';h.critical_protocols=[];assert.throws(()=>O.stampWrite(delivered,received,user,now.toISOString()),/Override/);assert.ok(O.stampWrite(delivered,received,{...user,role:'supervisor'},now.toISOString()).handovers[0].receipt_override);
});
test('resumo não vaza condomínios de registros resolvidos ao restringir acesso',()=>{
 const s=state([item(1),item(2,{condo:'B',status:'Resolvido'})]),u={...user,condos:null},n=structuredClone(s);n.handovers=[{...delivery(s,u),snapshot:[s.items[0]],open_ids:'[1]'}];n.nextHandover=2;const saved=O.stampWrite(s,n,u,now.toISOString());assert.equal(O.visible(saved,user).handovers.length,0);
});
