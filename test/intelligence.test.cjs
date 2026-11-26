'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const I=require('../src/intelligence.js'),{Intelligence}=require('../desktop/intelligence.cjs'),{Store,empty}=require('../desktop/store.cjs'),{stampWrite,visible}=require('../desktop/operations.cjs');
const now=new Date('2026-09-29T12:00:00-03:00'),admin={userId:'admin',display_name:'Gestão',role:'admin',condos:null},supervisor={userId:'supervisor',display_name:'Supervisor',role:'supervisor',condos:['A']},operator={userId:'operator',display_name:'Ana',role:'operator',condos:['A']};
const item=(id,extra={})=>({id,protocol:'MOP-20260929-'+String(id).padStart(6,'0'),condo:'A',subject:'Câmera sem imagem',category:'Ocorrência',priority:'Urgente',status:'Pendente',created_at:'2026-09-29T10:00:00-03:00',updated_at:'2026-09-29T10:00:00-03:00',created_by:'Ana',created_identity:{user_id:'operator',display_name:'Ana'},...extra});
const state=(rows=[item(1)])=>({...empty(),items:rows,nextItem:Math.max(0,...rows.map(x=>x.id))+1});
function setup(t,rows){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop-intelligence-')),store=new Store(dir),service=new Intelligence(store);store.intelligence=service;if(rows)store.write(state(rows),admin);t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});return {store,service,dir};}
test('SLA usa quatro padrões, aliases legados e regra exata de categoria',()=>{
 const p=I.defaults();assert.equal(I.baseline(item(1),p).minutes,30);assert.equal(I.baseline(item(1,{priority:'Alta'}),p).minutes,120);assert.equal(I.baseline(item(1,{priority:'Normal'}),p).minutes,480);assert.equal(I.baseline(item(1,{priority:'Atenção'}),p).minutes,120);assert.equal(I.baseline(item(1,{priority:'Baixa'}),p).minutes,1440);
 p.rules=[{category:'Ocorrência',priority:'Urgente',minutes:45}];assert.equal(I.baseline(item(1),p).minutes,45);assert.equal(I.baseline(item(1,{category:'Acesso'}),p).minutes,30);
});
test('SLA respeita fronteiras, resolução e prazo manual independente',()=>{
 const x=item(1,{deadline:'2026-09-30T18:00'}),base=I.baseline(x);
 assert.equal(I.sla(x,base,new Date('2026-09-29T10:14:59-03:00')).state,'within');assert.equal(I.sla(x,base,new Date('2026-09-29T10:15:00-03:00')).state,'near');assert.equal(I.sla(x,base,new Date('2026-09-29T10:30:00-03:00')).state,'near');assert.equal(I.sla(x,base,new Date('2026-09-29T10:30:00.001-03:00')).state,'breached');
 assert.equal(I.sla({...x,status:'Resolvido',resolved_at:'2026-09-29T10:30:00-03:00'},base,now).state,'within');assert.equal(I.sla({...x,status:'Resolvido'},base,now).state,'unknown');assert.equal(I.sla(item(2,{created_at:'invalid'})).state,'unknown');
});
test('configuração inválida e regras duplicadas são rejeitadas',()=>{
 for(const n of [0,-1,1.2,Infinity,525601,'30'])assert.throws(()=>I.validatePolicy({...I.defaults(),nearMinutes:n}),/inválida/);
 const rule={category:'Ocorrência',priority:'Urgente',minutes:10};assert.throws(()=>I.validatePolicy({...I.defaults(),rules:[rule,rule]}),/duplicada/);
});
test('busca normaliza acentos, combina filtros e respeita autoria por identidade e escopo',()=>{
 const rows=[item(1,{assignee:'João',description:'portão avariado',deadline:'2026-09-29T11:59'}),item(2,{condo:'B'}),item(3,{created_identity:{user_id:'other'},created_by:'Ana'}),item(4,{deleted_at:'2026-09-29'})];
 assert.deepEqual(I.search(rows,{q:'camera portao',assignee:'joao',mine:true,overdue:true,priority:'Urgente',from:'2026-09-29',to:'2026-09-29'},operator,now).map(x=>x.id),[1]);assert.deepEqual(I.search(rows,{mine:true},operator,now).map(x=>x.id),[1]);assert.equal(I.search(rows,{condo:'B'},operator,now).length,0);assert.deepEqual(I.search(rows,{unassigned:true},operator,now).map(x=>x.id),[3]);assert.throws(()=>I.search(rows,{from:'2026-10-01',to:'2026-09-01'},operator),/anteceder/);
});
test('notificações cobrem seis causas, SLA, fronteiras, turno por usuário e não alteram dados',()=>{
 const s=state([item(1,{deadline:'2026-09-29T11:59'}),item(2,{created_at:'2026-09-29T11:55:00-03:00',updated_at:'2026-09-29T11:55:00-03:00',deadline:'2026-09-29T12:10'}),item(3,{condo:'B'})]);s.templates=[{id:1,key:'routine',condo:'A',title:'Ronda',start_date:'2026-09-01',frequency:'daily',steps:['Portão']}];s.nextTemplate=2;const before=structuredClone(s);
 const notices=I.notifications(s,operator,I.defaults(),{[s.items[0].protocol]:{state:'breached',due_at:'2026-09-29T10:30:00-03:00',label:'SLA violado'}},now);
 for(const type of ['overdue','deadline','stale','critical','shift','checklist','sla'])assert.ok(notices.some(n=>n.type===type),type);assert.ok(!notices.some(n=>n.condo==='B'));assert.deepEqual(s,before);assert.equal(new Set(notices.map(n=>n.key)).size,notices.length);
 s.handovers.push({receipt_slot:'2026-09-29-D',receipt_user_id:'operator'});s.runs.push({template_key:'routine',slot:'2026-09-29'});assert.ok(!I.notifications(s,operator,I.defaults(),{},now).some(n=>['shift','checklist'].includes(n.type)));assert.ok(!I.notifications(s,{...operator,role:'viewer'},I.defaults(),{},now).some(n=>n.type==='shift'));
});
test('configuração exige admin integral e preserva baseline de registros existentes',t=>{
 const {service,store}=setup(t,[item(1)]),before=service.snapshot(admin,now).slas[item(1).protocol];const p=I.defaults();p.minutes.Urgente=60;
 for(const user of [operator,supervisor,{...admin,condos:['A']},{...operator,role:'viewer'}])assert.throws(()=>service.configure(user,p),/integral/);
 service.configure(admin,p);assert.equal(service.snapshot(admin,now).slas[item(1).protocol].due_at,before.due_at);const next=store.read();next.items.push(item(2));next.nextItem=3;store.write(next,admin);assert.equal(service.snapshot(admin,now).slas[item(2).protocol].minutes,60);
});
test('override exige motivo, escopo e perfil; alteração e auditoria são atômicas',t=>{
 const {service}=setup(t,[item(1),item(2,{condo:'B'})]);const change={id:1,due_at:'2026-09-29T16:00',reason:'Manutenção programada'};
 assert.throws(()=>service.override(operator,change),/exclusivo/);assert.throws(()=>service.override(supervisor,{...change,id:2}),/indisponível/);assert.throws(()=>service.override(supervisor,{...change,reason:'x'}),/justificativa/);
 service.override(supervisor,change);assert.equal(service.audit(supervisor,{action:'sla.override'}).rows.length,1);
 const before=service.snapshot(admin,now).slas[item(1).protocol].due_at,append=service.append;service.append=()=>{throw Error('disk failure');};assert.throws(()=>service.override(supervisor,{...change,due_at:'2026-09-29T18:00'}),/disk/);service.append=append;assert.equal(service.snapshot(admin,now).slas[item(1).protocol].due_at,before);
});
test('auditoria imutável, ordenada, com escopo estrito e sem e-mails',t=>{
 const {service}=setup(t);service.append('auth.failed',null,{code:'LOGIN_REJECTED'});service.append('record.deleted',admin,{record:'A'},['A']);service.append('record.deleted',admin,{record:'B'},['B']);service.append('record.updated',admin,{note:'mail@example.com'},['A','B']);
 assert.throws(()=>service.audit(operator),/exclusivo/);assert.equal(service.audit(supervisor).total,1);assert.equal(service.audit({...supervisor,condos:[]}).total,0);assert.equal(service.audit(admin,{action:'record.deleted'}).total,2);assert.ok(!JSON.stringify(service.audit(admin)).includes('@'));
 assert.throws(()=>service.db.prepare('UPDATE intelligence_audit SET digest=?').run('fake'),/imutável/);assert.throws(()=>service.db.exec('DELETE FROM intelligence_audit'),/imutável/);
 service.db.prepare('INSERT INTO intelligence_audit(payload,previous,digest) VALUES(?,?,?)').run('{}','bad','bad');assert.throws(()=>service.audit(admin),/integridade/);
});
test('favoritos pessoais persistem sem elevar acesso e validam limites',t=>{
 const {service}=setup(t);service.saveFavorite(operator,{name:'Meus urgentes',filters:{mine:true,urgent:true,condo:'A'}});assert.equal(service.favorites(supervisor).length,0);assert.equal(service.favorites(operator).length,1);assert.throws(()=>service.saveFavorite(operator,{name:'B',filters:{condo:'B'}}),/acesso/);assert.equal(new Intelligence(service.store).favorites(operator).length,1);service.removeFavorite(supervisor,'Meus urgentes');assert.equal(service.favorites(operator).length,1);service.removeFavorite(operator,'Meus urgentes');assert.equal(service.favorites(operator).length,0);
});
test('marcar aviso não altera item, persiste por conta e rejeita chave externa',t=>{
 const {service,store}=setup(t,[item(1)]);const before=store.read(),n=service.snapshot(operator).notifications.find(n=>n.type==='shift');service.mark(operator,n.key);assert.ok(service.snapshot(operator).notifications.find(x=>x.key===n.key).read);assert.ok(!service.snapshot(supervisor).notifications.some(x=>x.read));assert.deepEqual(store.read(),before);assert.throws(()=>service.mark(operator,'critical:hidden'),/acesso/);
});
test('falha na auditoria reverte gravação operacional; backup inclui política e trilha',t=>{
 const {service,store}=setup(t,[item(1)]),before=store.read(),next=structuredClone(before);next.items[0].status='Resolvido';const append=service.append;service.changes=()=>{throw Error('audit failed');};assert.throws(()=>store.write(next,admin),/audit failed/);assert.deepEqual(store.read(),before);service.append=append;const data=JSON.parse(fs.readFileSync(store.backup()));assert.ok(data._intelligence.policy);assert.ok(data._intelligence.audit.length);assert.ok(data._intelligence.sla.length);
});
test('recebimento override não aceita operador nem identidade forjada',()=>{
 const before=state([item(1)]),next=structuredClone(before);next.handovers.push({id:1,snapshot:[item(1)],open_ids:'[1]',receipt_at:now.toISOString(),receipt_slot:'2026-09-29-D',receipt_user_id:'forged',receipt_override:true,receipt_note:'Emergência autorizada',critical_protocols:[]});next.nextHandover=2;
 assert.throws(()=>stampWrite(before,structuredClone(next),operator),/Override/);const saved=stampWrite(before,structuredClone(next),supervisor);assert.equal(saved.handovers[0].receipt_user_id,'supervisor');assert.equal(saved.handovers[0].incoming,'Supervisor');
});

test('histórico deduplica, mantém resolvidos, persiste e refaz o escopo',t=>{
 const {service,store}=setup(t,[item(1)]),time=new Date();
 const first=service.snapshot(operator,time);service.snapshot(operator,time);
 assert.equal(service.snapshot(operator,time).history.length,first.history.length);
 const recordNotice=first.history.find(n=>n.itemId===1);
 assert.equal(recordNotice.recordProtocol,String(store.read().items[0].protocol||1));
 const key=recordNotice.key;service.mark(operator,key);
 assert.ok(new Intelligence(store).snapshot(operator,time).history.find(n=>n.key===key).read);
 const s=store.read();s.items[0].status='Resolvido';store.write(s,admin);
 const resolved=service.snapshot(operator,time);assert.ok(resolved.history.some(n=>n.key===key&&!n.active));
 assert.ok(!service.snapshot({...operator,condos:[]},time).history.some(n=>n.itemId));
 assert.throws(()=>service.mark({...operator,condos:[]},key),/acesso/);
 service.markAll(operator);assert.ok(service.snapshot(operator,time).history.every(n=>n.read));
 assert.ok(service.snapshot(supervisor,time).history.every(n=>!n.read));
 assert.equal(service.snapshot({...operator,role:'viewer'},new Date(+time+31*86400000)).history.length,0);
});
