'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../desktop/store.cjs');const {SyncEngine,configuration}=require('../desktop/sync-engine.cjs');
const workspace='00000000-0000-4000-8000-000000000001';
function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop-engine-')),store=new Store(dir);let offline=false,allowed=true,session=null,options,realtime;
  const rows=new Map(),operations=new Map();let revision=0;
  const client={
    auth:{getSession:async()=>({data:{session}}),signInWithPassword:async({email})=>{session={user:{id:'user-1',email}};return {data:{user:session.user,session}};},stopAutoRefresh:()=>{}},
    channel:()=>{const c={on:(_type,_filter,cb)=>{realtime=cb;return c;},subscribe:()=>c};return c;},removeChannel:async()=>{},
    from:table=>{
      let cursor=0;const query={select:()=>query,eq:()=>query,gt:(_key,value)=>{cursor=value;return query;},order:()=>query,limit:()=>query,
        then:(resolve,reject)=>Promise.resolve().then(()=>{if(offline)throw Error('Sem rede');return {data:table==='mop_members'?(allowed?[{workspace_id:workspace}]:[]):[...rows.values()].filter(r=>r.revision>cursor).sort((a,b)=>a.revision-b.revision),error:null};}).then(resolve,reject)};return query;
    },
    rpc:async(_fn,p)=>{
      if(offline)throw Error('Sem rede');if(operations.has(p.p_op))return {data:operations.get(p.p_op)};
      const old=rows.get(p.p_id);if(old&&old.version!==p.p_base)return {data:{ok:false,record:old}};
      const record={id:p.p_id,kind:p.p_kind,payload:p.p_payload,version:(old?.version||0)+1,revision:++revision};rows.set(record.id,record);
      const result={ok:true,record};operations.set(p.p_op,result);return {data:result};
    }
  };
  const events=[];const engine=new SyncEngine(store,{notify:s=>events.push(s),clientFactory:(_url,_key,o)=>{options=o;return client;}});
  t.after(()=>{engine.close();store.close();fs.rmSync(dir,{recursive:true,force:true});});
  return {engine,store,events,rows,client,offline:v=>{offline=v;},allow:v=>{allowed=v;},realtime:()=>realtime(),options:()=>options};
}
test('motor: conecta, salva sem rede, reconecta e exige permissão; senha não é persistida',async t=>{
  const f=fixture(t);
  await f.engine.connect({url:'https://test.supabase.co',key:'sb_publishable_test',email:'a@example.com',password:'never-store-me',uploadExisting:true});await f.engine.kick();
  f.offline(true);const state=f.store.read();state.items.push({id:1,protocol:'MOP-20260927-ABCDEF',subject:'Offline',status:'Pendente',condo:'CEA'});state.nextItem=2;f.store.write(state);await f.engine.kick();
  assert.equal(f.engine.status().state,'offline');assert.equal(f.engine.status().pending,1);assert.equal(f.rows.size,0);
  f.offline(false);await f.engine.kick();assert.equal(f.engine.status().state,'online');assert.equal(f.rows.size,1);assert.equal(f.engine.status().pending,0);
  assert.equal(f.options().auth.persistSession,false);assert.ok(!JSON.stringify(f.store.db.prepare('select * from sync_settings').all()).includes('never-store-me'));
  f.allow(false);await f.engine.kick();assert.equal(f.engine.status().state,'offline');assert.match(f.engine.status().message,/permissão/);
  await f.engine.disconnect();assert.equal(f.engine.status().state,'local');assert.equal(f.store.read().items.length,1);
});
test('motor: notificação aplica atualização remota e sinaliza a interface',async t=>{
  const f=fixture(t);await f.engine.connect({url:'https://test.supabase.co',key:'sb_publishable_test',email:'a@example.com',password:'test'});await f.engine.kick();
  f.rows.set('11111111-1111-4111-8111-111111111111',{id:'11111111-1111-4111-8111-111111111111',kind:'items',version:1,revision:1,payload:{subject:'Remoto',status:'Pendente',protocol:'MOP-20260927-ABCDEF'}});
  f.realtime();await f.engine.kick();assert.equal(f.store.read().items[0].subject,'Remoto');assert.ok(f.events.some(s=>s.dataChanged));
});
test('configuração rejeita chaves secretas e destinos diferentes do Supabase',()=>{
  assert.throws(()=>configuration({url:'http://test.supabase.co',key:'sb_publishable_x'}),/HTTPS/);
  assert.throws(()=>configuration({url:'https://example.com',key:'sb_publishable_x'}),/HTTPS/);
  assert.throws(()=>configuration({url:'https://test.supabase.co',key:'sb_secret_x'}),/publicável/);
});
test('login prepara protocolos legados antes de publicar a primeira alteração',async t=>{
  const f=fixture(t);const state=f.store.read();state.items.push({id:1,subject:'Legado',status:'Pendente',condo:'CEA',created_at:'2026-09-27T12:00:00Z'});state.nextItem=2;f.store.write(state);
  await f.engine.connect({url:'https://test.supabase.co',key:'sb_publishable_test',email:'a@example.com',password:'test',uploadExisting:true});await f.engine.kick();
  assert.match(f.store.read().items[0].protocol,/^MOP-20260927-[A-F0-9]{12}$/);assert.equal([...f.rows.values()][0].payload.protocol,f.store.read().items[0].protocol);assert.equal(f.engine.status().pending,0);
});
