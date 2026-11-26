'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../desktop/store.cjs');
const exp=require('../desktop/report-export105.cjs');
const sessions={operator:{userId:'op',role:'operator',condos:['CEA']},supervisor:{userId:'sup',role:'supervisor',display_name:'Supervisora Operacional',condos:['CEA']},admin:{userId:'adm',role:'admin',condos:null}};
function setup(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop105-'));const store=new Store(dir);
 const state=store.read(),now=new Date().toISOString();
 state.items.push({id:1,protocol:'MOP-001',condo:'CEA',category:'Segurança',subject:'Câmera sem sinal',description:'Equipamento fora do ar',status:'Pendente',priority:'Alta',created_at:now,updated_at:now,created_by:'Operador',action_taken:''});
 state.items.push({id:2,protocol:'MOP-002',condo:'CONDOMINIO-RESTRITO',category:'Segurança',subject:'Incidente confidencial',description:'Não exportar',status:'Pendente',created_at:now,updated_at:now,created_by:'Operador'});
 state.items.push({id:3,protocol:'MOP-003',condo:'CEA',category:'Rotina',subject:'=HYPERLINK("https://bad")',description:'+SOMA(A1:A2)',status:'Resolvido',created_at:now,updated_at:now,created_by:'Operador'});
 state.nextItem=4;store.write(state);return {store,cleanup:()=>{store.close();fs.rmSync(dir,{recursive:true,force:true})}};
}
const filt={section:'overview',period:'Todos os períodos',condo:'Todos os condomínios',category:'Todas as categorias',status:'Todos os status'};
test('Access denied for operator and viewer even with export payload',()=>{const {store,cleanup}=setup();try{assert.throws(()=>exp.createData(store,sessions.operator,filt),/exclusivos/);assert.throws(()=>exp.createData(store,{role:'viewer'},filt),/exclusivos/)}finally{cleanup()}});
test('Supervisor export is strictly scoped to authorized condominium',()=>{const {store,cleanup}=setup();try{const report=exp.createData(store,sessions.supervisor,filt);assert.equal(report.rows.length,2);assert.ok(report.rows.every(r=>r[2]==='CEA'));assert.equal(report.operator,'Supervisora Operacional');assert.throws(()=>exp.createData(store,sessions.supervisor,{...filt,condo:'CONDOMINIO-RESTRITO'}),/fora do escopo/)}finally{cleanup()}});
test('Report filters apply before document and metrics generation',()=>{const {store,cleanup}=setup();try{const r=exp.createData(store,sessions.supervisor,{...filt,section:'occurrences',status:'Pendente'});assert.equal(r.rows.length,1);assert.equal(r.rows[0][0],'MOP-001');assert.equal(r.stats.find(([x])=>x==='Pendentes')[1],1);assert.throws(()=>exp.createData(store,sessions.admin,{...filt,period:'Últimos -100 dias'}),/inválidos/)}finally{cleanup()}});
test('Excel exports contain metadata and escape formula-like text',async()=>{const {store,cleanup}=setup();try{const report=await exp.enrichReport(exp.createData(store,sessions.supervisor,filt),store,null,sessions.supervisor);const bytes=await exp.sheets(report).xlsx.writeBuffer();const ExcelJS=require('exceljs'),book=new ExcelJS.Workbook();await book.xlsx.load(bytes);assert.equal(book.getWorksheet('Detalhamento').rowCount,3);assert.equal(book.getWorksheet('Resumo').getCell('B3').value,'Todos os períodos');const row=[...book.getWorksheet('Detalhamento').getRows(2,2)];assert.ok(row.some(r=>String(r.getCell(2).value).startsWith("'=HYPERLINK")));assert.ok(!String(bytes).includes('CONDOMINIO-RESTRITO'))}finally{cleanup()}});
test('PDF HTML escapes operational content and includes no other condominium',async()=>{const {store,cleanup}=setup();try{const report=await exp.enrichReport(exp.createData(store,sessions.supervisor,filt),store,null,sessions.supervisor);const html=exp.html(report);assert.ok(html.includes('MOP-001'));assert.ok(!html.includes('CONDOMINIO-RESTRITO'));assert.ok(html.includes('Central')||html.includes('CENTRAL'))}finally{cleanup()}});

test('Dashboard export keeps the selected records and rechecks scope, status and dates', async () => {
 const {store,cleanup}=setup();
 try{
  const state=store.read();
  const now=Date.now();
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  state.items[0].deadline=new Date(now-3600000).toISOString();
  store.write(state);
  const selection={ids:['MOP-001'],start:day,end:day,selectedDate:day,metric:'overdue',dimension:'category',group:'Segurança'};
  const payload={...filt,dashboard:selection};
  const report=exp.createData(store,sessions.supervisor,payload);
  assert.deepEqual(report.rows.map(row=>row[0]),['MOP-001']);
  assert.equal(report.dashboard.series[0][1],1);
  assert.equal(report.stats.find(([label])=>label==='Ocorrências vencidas')[1],1);
  assert.match(exp.html(report),/Evolução diária/);
  assert.match(exp.html(report),/Distribuição por categoria/);
  assert.doesNotMatch(exp.html(report),/MOP-002|MOP-003/);
  const workbook=exp.sheets(report);
  assert.equal(workbook.getWorksheet('Detalhamento').rowCount,2);
  assert.equal(workbook.getWorksheet('Evolução').getCell('B2').value,1);
  assert.throws(()=>exp.createData(store,sessions.operator,payload),/exclusivos/);
  assert.throws(()=>exp.createData(store,sessions.supervisor,{...payload,dashboard:{...selection,ids:['MOP-001','MOP-002']}}),/Atualize/);
  assert.throws(()=>exp.createData(store,sessions.supervisor,{...payload,dashboard:{...selection,selectedDate:'2026-02-30'}}),/inválido/);
  state.items[0].status='Resolvido';
  store.write(state);
  assert.throws(()=>exp.createData(store,sessions.supervisor,payload),/Atualize/);
 }finally{cleanup()}
});
