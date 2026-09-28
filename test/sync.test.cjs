'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../desktop/store.cjs');
const {SyncStore}=require('../desktop/sync-store.cjs');
const {randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const workspace='00000000-0000-4000-8000-000000000001';
const user='11111111-1111-4111-8111-111111111111';
async function server(t){
  const db=new PGlite();t.after(()=>db.close());
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    insert into auth.users values('${user}');`);
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/mop.sql'),'utf8'));
  await db.exec(`insert into public.mop_members values('${workspace}','${user}');set request.jwt.claim.sub='${user}';`);
  return {
    db,
    push:async op=>(await db.query('select public.mop_push($1,$2,$3,$4,$5,$6) result',[workspace,op.op,op.id,op.kind,op.base,JSON.stringify(op.payload)])).rows[0].result,
    pull:async cursor=>(await db.query('select * from mop_records where revision>$1 order by revision',[cursor])).rows
  };
}
function device(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop-sync-'));const store=new Store(dir),sync=new SyncStore(store);
  t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});
  sync.bind('https://test.supabase.co|'+workspace);return {store,sync,dir};
}
function add(d,subject,protocol='MOP-20260927-'+randomUUID().replaceAll('-','').slice(0,12).toUpperCase()){
  const s=d.store.read();const id=s.nextItem++;
  s.items.push({id,protocol,subject,status:'Pendente',condo:'CEA',company:'',category:'Ocorrência',reference:'',priority:'Normal',description:'Teste',action_taken:'',next_action:'',created_by:'Teste',updated_by:'Teste',created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
  s.events.push({id:s.nextEvent++,item_id:id,at:new Date().toISOString(),actor:'Teste',kind:'Criado',detail:subject});d.store.write(s);return id;
}
async function sync(d,s){
  const rows=await s.pull(Number(d.sync.setting('cursor')||0));
  if(rows.length)d.sync.apply(rows,rows.at(-1).revision);
  for(let i=0;i<100;i++){const op=d.sync.next();if(!op)return;d.sync.acknowledge(op,await s.push(op));}throw Error('Fila não terminou');
}
test('duas máquinas offline: IDs locais iguais, histórico, passagem e reconexão sem duplicação',async t=>{
  const s=await server(t),a=device(t),b=device(t);
  add(a,'Máquina A');add(b,'Máquina B');
  const state=a.store.read();state.handovers.push({id:1,at:new Date().toISOString(),incoming:'B',outgoing:'A',note:'Recebido offline',open_ids:'[1]',snapshot:[{...state.items[0]}]});state.nextHandover=2;a.store.write(state);
  await sync(a,s);await sync(b,s);await sync(a,s);await sync(b,s);
  for(const d of [a,b]){const data=d.store.read();assert.equal(data.items.length,2);assert.equal(data.events.length,2);assert.equal(data.handovers.length,1);assert.equal(d.sync.status().pending,0);
    const event=data.events.find(e=>e.detail==='Máquina A');assert.equal(data.items.find(i=>i.id===event.item_id).subject,'Máquina A');
    const h=data.handovers[0];assert.equal(data.items.find(i=>i.id===JSON.parse(h.open_ids)[0]).subject,'Máquina A');assert.equal(h.snapshot[0].id,JSON.parse(h.open_ids)[0]);
  }
});
test('resposta perdida e edição durante envio: operação idempotente e fila persistente',async t=>{
  const s=await server(t),a=device(t);add(a,'Original');const op=a.sync.next();await s.push(op);
  const state=a.store.read();state.items[0].subject='Alterado enquanto enviava';a.store.write(state);
  const reopened=new Store(a.dir);const ledger=new SyncStore(reopened);assert.deepEqual(ledger.next(),op);reopened.close();
  a.sync.acknowledge(op,await s.push(op));await sync(a,s);
  const rows=await s.pull(0);assert.equal(rows.find(r=>r.kind==='items').payload.subject,'Alterado enquanto enviava');assert.equal(rows.length,2);assert.equal(a.sync.status().pending,0);
});
test('conflito preserva ambas as versões e resolução local passa por nova comparação',async t=>{
  const s=await server(t),a=device(t),b=device(t);add(a,'Original');await sync(a,s);await sync(b,s);
  for(const [d,subject] of [[a,'Versão A'],[b,'Versão B']]){const state=d.store.read();state.items[0].subject=subject;d.store.write(state);}
  await sync(a,s);await sync(b,s);const [c]=b.sync.conflicts();assert.equal(c.local.subject,'Versão B');assert.equal(c.remote.payload.subject,'Versão A');
  assert.equal(b.store.read().items[0].subject,'Versão B');
  assert.throws(()=>b.sync.resolve(c.id,'local',1),/mudou novamente/);
  b.sync.resolve(c.id,'local',c.remote.version);await sync(b,s);await sync(a,s);assert.equal(a.store.read().items[0].subject,'Versão B');
  assert.equal(b.store.db.prepare('SELECT count(*) n FROM sync_resolutions').get().n,1);
});
test('backup falhando reverte dados e fila; importação destrutiva não apaga registros sincronizados',t=>{
  const a=device(t);add(a,'Preservar');const before=a.store.read(),pending=a.sync.status().pending;
  const changed=structuredClone(before);changed.items[0].subject='Não gravar';const backup=a.store.backup.bind(a.store);a.store.backup=()=>{throw Error('disco cheio');};
  assert.throws(()=>a.store.write(changed),/disco cheio/);assert.deepEqual(a.store.read(),before);assert.equal(a.sync.status().pending,pending);a.store.backup=backup;
  assert.throws(()=>a.store.write({items:[],events:[],handovers:[],nextItem:1,nextEvent:1,nextHandover:1}),/substituída/);assert.deepEqual(a.store.read(),before);
});
test('recibo antigo depois de resposta perdida não oculta edição posterior de outra máquina',async t=>{
  const s=await server(t),a=device(t),b=device(t);add(a,'Original');const op=a.sync.next();await s.push(op);
  await sync(b,s);const state=b.store.read();state.items[0].subject='Atualização mais recente';b.store.write(state);await sync(b,s);
  await sync(a,s);await sync(a,s);assert.equal(a.store.read().items[0].subject,'Atualização mais recente');assert.equal(a.sync.status().pending,0);
});
test('cópia do mesmo backup converge sem duplicar; escolha remota preserva versão local na auditoria',async t=>{
  const s=await server(t),a=device(t),b=device(t);add(a,'Mesmo backup');b.store.write(a.store.read());await sync(a,s);await sync(b,s);
  assert.equal((await s.pull(0)).length,2);
  for(const [d,subject] of [[a,'Central'],[b,'Local']]){const state=d.store.read();state.items[0].subject=subject;d.store.write(state);}
  await sync(a,s);await sync(b,s);const [c]=b.sync.conflicts();b.sync.resolve(c.id,'remote',c.remote.version);
  assert.equal(b.store.read().items[0].subject,'Central');assert.equal(b.sync.status().pending,0);
  assert.equal(JSON.parse(b.store.db.prepare('SELECT local FROM sync_resolutions').get().local).subject,'Local');
});
test('SQL: acesso anônimo/operador externo negado, escrita direta negada e migração repetível',async t=>{
  const s=await server(t),a=device(t);add(a,'Restrito');await sync(a,s);
  await s.db.exec(fs.readFileSync(path.join(__dirname,'../supabase/mop.sql'),'utf8'));
  await s.db.exec('set role authenticated');assert.equal((await s.db.query('select * from mop_records')).rows.length,2);
  await assert.rejects(s.db.exec('delete from mop_records'),/permission denied/);
  await s.db.exec("set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222'");assert.equal((await s.db.query('select * from mop_records')).rows.length,0);
  await assert.rejects(s.push({id:randomUUID(),op:randomUUID(),kind:'items',base:0,payload:{}}),/sem acesso/);
  await s.db.exec('reset role;set role anon');await assert.rejects(s.db.query('select * from mop_records'),/permission denied/);
  await assert.rejects(s.push({id:randomUUID(),op:randomUUID(),kind:'items',base:0,payload:{}}),/permission denied/);
});
