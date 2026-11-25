'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../src/operations.js');
const now=new Date('2026-09-29T12:00:00-03:00');
const item=(id,extra={})=>({id,created_at:'2026-09-29T09:00:00-03:00',updated_at:'2026-09-29T11:00:00-03:00',condo:'A',status:'Pendente',priority:'Normal',category:'Câmeras',created_by:'Ana',...extra});
const fixture=()=>({items:[item(1,{priority:'Urgente',deadline:'2026-09-29T10:00'}),item(2,{status:'Resolvido',deadline:'2026-09-29T12:00',resolved_at:'2026-09-29T11:00:00-03:00'}),item(3,{condo:'B',created_by:'Bia',category:'Portão',created_at:'2026-09-29T03:00:00-03:00'}),item(4,{created_at:'2026-09-28T12:00:00-03:00'}),item(5,{deleted_at:'2026-09-29'})],events:[]});
test('períodos e anteriores equivalentes atravessam mês, ano e fevereiro bissexto',()=>{
 assert.deepEqual(D.period({period:'today'},now).previous,{from:'2026-09-28',to:'2026-09-28'});
 assert.equal(D.period({period:'7d'},now).from,'2026-09-23');assert.equal(D.period({period:'30d'},now).from,'2026-08-31');
 assert.deepEqual(D.period({period:'month'},now).previous,{from:'2026-08-03',to:'2026-08-31'});
 assert.equal(D.period({period:'7d'},new Date('2026-01-02T01:00:00Z')).to,'2026-01-01');
 assert.equal(D.period({from:'2024-02-28',to:'2024-03-01'}).days,3);
 for(const f of [{from:'2026-02-30',to:'2026-03-02'},{from:'2026-10-01',to:'2026-09-01'},{period:'custom'}])assert.throws(()=>D.period(f,now),/válido/);
});
test('agrupamentos, evolução zero-filled, anterior e KPIs usam o mesmo recorte sem mutar dados',()=>{
 const s=fixture(),before=structuredClone(s),m=D.metrics(s,{period:'today'},now);
 assert.equal(m.total,3);assert.equal(m.open,2);assert.equal(m.late,1);assert.equal(m.averageHours,2);assert.equal(m.onTime,100);assert.equal(m.previous.total,1);assert.equal(m.changes.total.percent,200);
 assert.deepEqual(m.byPriority,[['Normal',2],['Urgente',1]]);assert.deepEqual(m.byStatus,[['Pendente',2],['Resolvido',1]]);assert.deepEqual(m.byCondo,[['A',2],['B',1]]);assert.deepEqual(m.byOperator,[['Ana',2],['Bia',1]]);assert.deepEqual(m.byCategory,[['Câmeras',2],['Portão',1]]);assert.deepEqual(m.byShift,[['Diurno',2],['Noturno',1]]);assert.deepEqual(m.timeline,[['2026-09-29',3]]);
 assert.deepEqual(D.metrics(s,{period:'7d'},now).timeline[0],['2026-09-23',0]);assert.deepEqual(s,before);
});
test('filtros, escopo e perfil não ampliam acesso nem expõem removidos ou e-mails',()=>{
 const s=fixture();s.items[0].created_by='private@example.com';
 const m=D.metrics(s,{period:'today',include_deleted:true},now,{role:'supervisor',condos:['A']});assert.equal(m.total,2);assert.ok(!JSON.stringify(m).includes('@'));assert.deepEqual(m.byCondo,[['A',2]]);
 assert.equal(D.metrics(s,{period:'today',condo:'B'},now,{role:'admin',condos:['A']}).total,0);
 assert.equal(D.metrics(s,{period:'today',status:'Resolvido'},now).total,1);
 assert.equal(D.metrics(s,{period:'today'},now,{role:'admin',condos:[]}).total,0);
 for(const role of ['viewer','operator'])assert.throws(()=>D.metrics(s,{},now,{role,condos:null}),/exclusivo/);
});
test('resolução usa transição real, ordem cronológica, prazo válido e explicita estimativa legada',()=>{
 const s={items:[item(1,{status:'Resolvido',deadline:'2026-09-29T10:00:00',updated_at:'2026-09-30T12:00:00-03:00'})],events:[{item_id:1,at:'2026-09-29T11:00:00-03:00',before:{status:'Resolvido'},after:{status:'Resolvido'}},{item_id:1,at:'2026-09-29T10:00:00-03:00',before:{status:'Pendente'},after:{status:'Resolvido'}}]};
 let m=D.metrics(s,{period:'today'},now);assert.equal(m.averageHours,1);assert.equal(m.onTime,100);assert.equal(m.estimated,0);
 s.events=[];m=D.metrics(s,{period:'today'},now);assert.equal(m.estimated,1);assert.equal(m.onTime,0);
 s.items[0].deadline='invalid';assert.equal(D.metrics(s,{period:'today'},now).onTime,null);
 s.items[0].resolved_at='2026-09-28T10:00:00Z';assert.equal(D.metrics(s,{period:'today'},now).averageHours,null);
});
test('vazio, anterior zero, turnos 06h/18h e turno salvo têm valores definidos',()=>{
 const empty=D.metrics({items:[],events:[]},{period:'today'},now);assert.equal(empty.averageHours,null);assert.equal(empty.onTime,null);assert.equal(empty.changes.total.percent,null);assert.deepEqual(empty.attention,[]);
 const s={items:[item(1,{created_at:'2026-09-29T06:00:00-03:00'}),item(2,{created_at:'2026-09-29T18:00:00-03:00'}),item(3,{created_shift:{type:'Noturno'}})],events:[]};
 assert.deepEqual(D.metrics(s,{period:'today'},now).byShift,[['Noturno',2],['Diurno',1]]);
});
