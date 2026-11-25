'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../desktop/store.cjs'),{SyncEngine}=require('../desktop/sync-engine.cjs'),{Access}=require('../desktop/access.cjs');

function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop-login-sync-')),store=new Store(dir),cloud=require('./support/cloud.cjs')();
  const member={workspace_id:'00000000-0000-4000-8000-000000000001',user_id:'11111111-1111-4111-8111-111111111111',username:'marcelo',display_name:'Marcelo',role:'admin',condos:null,access_version:1};
  const from=cloud.client.from;
  // Model PostgREST projection: omitted columns must not appear in the result.
  cloud.client.from=table=>{if(table!=='mop_members')return from(table);let columns='*';const q={select:value=>{columns=value;return q;},eq:()=>q,then:(resolve,reject)=>Promise.resolve({data:[columns==='*'?{...member}:Object.fromEntries(columns.split(',').map(k=>[k,member[k]]))],error:null}).then(resolve,reject)};return q;};
  const sync=new SyncEngine(store,{clientFactory:()=>cloud.client});
  let locks=0;const access=new Access(sync,{onLock:()=>{locks++;}});
  sync.mayRun=()=>!!access.session;sync.onAccessDenied=()=>access.revoke();
  t.after(async()=>{await access.stopping;await sync.stopClient();access.close();sync.close();store.close();fs.rmSync(dir,{recursive:true,force:true});});
  return {access,sync,member,locks:()=>locks};
}

test('login com username permanece autenticado após sincronizações repetidas',async t=>{
  const f=fixture(t);await f.access.login({email:'test@example.com',password:'test-only',uploadExisting:true});
  for(let i=0;i<3;i++)await f.sync.kick();
  assert.equal(f.locks(),0);assert.equal(f.access.status().authenticated,true);
  assert.equal(f.access.status().username,'marcelo');assert.equal(f.sync.status().state,'online');
});

test('alteração real de permissão continua encerrando a sessão',async t=>{
  const f=fixture(t);await f.access.login({email:'test@example.com',password:'test-only',uploadExisting:true});await f.sync.kick();
  assert.equal(f.access.status().authenticated,true);
  f.member.role='viewer';f.member.access_version++;await f.sync.kick();
  assert.equal(f.access.status().authenticated,false);assert.ok(f.locks()>0);
});
