'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {empty,Store}=require('../desktop/store.cjs');const {SyncStore}=require('../desktop/sync-store.cjs');
const O=require('../desktop/operations.cjs'),D=require('../src/operations.js'),W=require('../src/workbook.js');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const admin={userId:'11111111-1111-4111-8111-111111111111',email:'admin@example.com',display_name:'Marcelo',role:'admin',condos:null};
function fixture(){const s=empty();s.items=[{id:1,condo:'A',subject:'Portão',protocol:'MOP-20260928-AAAAAA',status:'Pendente',priority:'Normal',created_at:'2026-09-28T10:00:00Z',updated_at:'2026-09-28T10:00:00Z'},{id:2,condo:'B',subject:'Câmera',protocol:'MOP-20260928-BBBBBB',status:'Pendente',priority:'Urgente',created_at:'2026-09-28T10:00:00Z',updated_at:'2026-09-28T10:00:00Z'}];s.nextItem=3;return s;}
test('escopo local não expõe itens, anexos, eventos ou passagens de outro condomínio',()=>{
 const s=fixture();s.events=[{id:1,item_id:2}];s.attachments=[{id:1,item_id:2}];s.handovers=[{id:1,snapshot:s.items},{id:2,snapshot:[s.items[0]]}];
 const filtered=O.visible(s,{...admin,condos:['A']});assert.equal(filtered.items.length,1);assert.equal(filtered.events.length,0);assert.equal(filtered.attachments.length,0);assert.deepEqual(filtered.handovers.map(x=>x.id),[2]);
});
test('autoria vem da sessão e gravação restrita preserva dados não visíveis',()=>{
 const s=fixture(),session={...admin,role:'operator',condos:['A']},next=O.visible(s,session);next.items[0].subject='Corrigido';next.items[0].updated_by='Falso';next.events.push({id:1,item_id:1,actor:'Falso',at:'2026-09-28T12:00:00Z',kind:'Atualizado',detail:'Correção'});next.nextEvent=2;
 const saved=O.stampWrite(s,next,session);assert.equal(saved.items.length,2);assert.equal(saved.items[0].updated_by,session.display_name);assert.equal(saved.events[0].author.user_id,session.userId);assert.equal(saved.events[0].actor,session.display_name);
 assert.throws(()=>O.stampWrite(s,next,{...session,role:'viewer'}),/consulta/);
 next.items[0].condo='B';assert.throws(()=>O.stampWrite(s,next,session),/acesso/);
});
test('passagem exige ciência crítica apenas no escopo autorizado',()=>{
 const s=fixture(),session={...admin,role:'operator',condos:['A']},next=O.visible(s,session);next.handovers.push({id:1,at:new Date().toISOString(),delivered_at:new Date().toISOString(),delivery_slot:'2026-09-29-D',outgoing:'Falso',incoming:'',open_ids:'[1]',snapshot:next.items,critical_protocols:[]});next.nextHandover=2;
 const delivered=O.stampWrite(s,next,session).handovers[0];assert.equal(delivered.outgoing,session.display_name);assert.equal(delivered.incoming,'');
 const all=fixture();all.handovers.push({id:1,at:new Date().toISOString(),delivered_at:new Date().toISOString(),delivery_slot:'2026-09-29-D',receipt_at:new Date().toISOString(),receipt_slot:'2026-09-29-D',incoming:'Falso',outgoing:'Anterior',open_ids:'[1,2]',snapshot:all.items,critical_protocols:[]});all.nextHandover=2;assert.throws(()=>O.stampWrite(fixture(),all,admin),/Confirme/);
});
test('recorrência respeita virada da noite, início e fim de mês',()=>{
 const t={frequency:'shift',start_date:'2026-09-01'};assert.equal(D.slot(t,new Date('2026-09-28T23:00:00-03:00')),D.slot(t,new Date('2026-09-29T05:00:00-03:00')));assert.notEqual(D.slot(t,new Date('2026-09-29T06:00:00-03:00')),D.slot(t,new Date('2026-09-29T05:00:00-03:00')));
 assert.equal(D.slot({frequency:'monthly',start_date:'2026-01-31'},new Date('2026-02-28T12:00:00-03:00')),'2026-02-28');assert.equal(D.slot({frequency:'daily',start_date:'2027-01-01'},new Date('2026-02-28')),null);
});
test('checklist exige respostas completas, perfil de supervisão e execução única',()=>{
 const s=fixture(),input=structuredClone(s);input.templates.push({id:1,key:'template-1',condo:'A',title:'Ronda',frequency:'daily',start_date:'2026-01-01',steps:['Câmera','Portão']});input.nextTemplate=2;
 assert.throws(()=>O.stampWrite(s,input,{...admin,role:'operator'}),/supervisores/);const configured=O.stampWrite(s,input,admin),n=structuredClone(configured);n.runs.push({id:1,template_key:'template-1',condo:'A',slot:'2026-09-28',answers:[{label:'Câmera',value:'ok'}]});n.nextRun=2;
 assert.throws(()=>O.stampWrite(configured,n,admin,'2026-09-28T12:00:00Z'),/incompleto/);n.runs[0].answers.push({label:'Portão',value:'fail'});const saved=O.stampWrite(configured,n,admin,'2026-09-28T12:00:00Z');assert.equal(D.due(saved,new Date('2026-09-28T12:00:00Z')).length,0);const duplicate=structuredClone(saved);duplicate.runs.push({...duplicate.runs[0],id:2});duplicate.nextRun=3;assert.throws(()=>O.stampWrite(saved,duplicate,admin,'2026-09-28T12:00:00Z'),/já concluído/);
});
test('anexos validam tipo real, tamanho e nome; relatórios escapam conteúdo',()=>{
 O.validateAttachment({mime:'application/pdf',content:Buffer.from('%PDF-1.4 test').toString('base64'),name:'teste.pdf'});
 assert.throws(()=>O.validateAttachment({mime:'image/png',content:Buffer.from('<script>').toString('base64'),name:'a.png'}),/conteúdo/);
 assert.throws(()=>O.validateAttachment({mime:'application/pdf',content:Buffer.alloc(600000).toString('base64'),name:'a.pdf'}),/512/);
 const s=fixture();s.items[0].subject='<script>alert(1)</script>';s.items[0].assignee='=HYPERLINK("x")';const html=D.report(s);assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(D.csv(s).includes("'=HYPERLINK"));
});
test('Excel gerado é ZIP OOXML com texto literal, inclusive fórmulas maliciosas',async()=>{
 const buffer=Buffer.from(W.report([{subject:'=1+1',condo:'São Paulo'}]));const unzip=require('unzipper');const directory=await unzip.Open.buffer(buffer);const sheet=(await directory.files.find(x=>x.path==='xl/worksheets/sheet1.xml').buffer()).toString();assert.match(sheet,/São Paulo/);assert.match(sheet,/=1\+1/);assert.ok(!sheet.includes('<f>'));assert.equal(directory.files.length,5);
});
test('novas coleções persistem, entram no backup e sincronizam referências de anexos',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop-ops-')),store=new Store(dir),ledger=new SyncStore(store);t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});ledger.bind('test');const s=fixture();s.attachments.push({id:1,item_id:1,name:'e.pdf',mime:'application/pdf',content:Buffer.from('%PDF-test').toString('base64')});s.nextAttachment=2;store.write(s);assert.equal(ledger.status().pending,3);const wire=ledger.wire('attachments',s.attachments[0]);assert.equal(wire.item_id,ledger.map('items',1).remote_id);const backup=store.backup();assert.equal(JSON.parse(fs.readFileSync(backup)).attachments.length,1);
});
