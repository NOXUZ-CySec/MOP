'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const shared=require('../desktop/shared-ops93.cjs'),notices=require('../desktop/swap-notices94.cjs');
const user='11111111-1111-4111-8111-111111111111',workspace='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const id='12345678-1234-4234-8234-123456789abc';
function fixture(role='operator'){
 const seen=new Map();
 const db={prepare(sql){return{all:owner=>[...(seen.get(owner)||[])].map(key=>({key})),run:(owner,key)=>{const all=seen.get(owner)||new Set();all.add(key);seen.set(owner,all);return {changes:1}}}}};
 const session={userId:user,role,mode:'online'};
 const sync={client:{},authenticated:true,userId:user,membership:{user_id:user,role,workspace_id:workspace},workspace:()=>workspace};
 return {db,session,sync,seen};
}
async function withRows(own,inbox,pending,cb){
 const original=shared.requests;
 shared.requests=async(_sync,_session,op)=>op==='load'?own:op==='inbox'?inbox:op==='pending'?pending:[];
 try{return await cb()}finally{shared.requests=original}
}
const row={id,work_date:'2026-12-01',colleague_work_date:'2026-12-02',employee_id:user,colleague_id:'22222222-2222-4222-8222-222222222222',created_at:'2026-11-19T10:00:00Z',reason:'Troca',status:'pending',colleague_response:'pending'};
test('94 notifications: teammate gets a new unread request and can mark it as read',async()=>{
 const f=fixture();
 await withRows([], [row], [],async()=>{
  const list=await notices.list(f.sync,f.session,f.db);
  assert.equal(list.length,1);assert.equal(list[0].title,'Troca aguardando seu aceite');assert.equal(list[0].read,false);
  assert.equal(list[0].target,"schedule");assert.equal(list[0].severity,"warning");
  assert.equal(notices.mark(f.db,f.session,list,list[0].key),true);
  const refreshed=await notices.list(f.sync,f.session,f.db);
  assert.equal(refreshed[0].read,true);
  assert.throws(()=>notices.mark(f.db,f.session,list,'swap94:other:foreign:accepted'),/não está disponível/);
 });
});
test('94 notifications: requester receives a new phase notice after colleague accepts',async()=>{
 const f=fixture();
 await withRows([{...row,colleague_response:'accepted'}],[],[],async()=>{
  const list=await notices.list(f.sync,f.session,f.db);
  assert.equal(list.length,1);assert.match(list[0].title,/aceitou/);
  notices.markAll(f.db,f.session,list);
  assert.equal((await notices.list(f.sync,f.session,f.db))[0].read,true);
 });
 const approved={...row,colleague_response:'accepted',status:'approved',decided_at:'2026-11-20T10:00:00Z'};
 await withRows([approved],[],[],async()=>{
  const list=await notices.list(f.sync,f.session,f.db);
  assert.equal(list.length,1);assert.equal(list[0].read,false);assert.equal(list[0].title,'Troca aprovada');
 });
});
test('94 notifications: supervisor only sees accepted requests not involving themselves',async()=>{
 const f=fixture('supervisor'),ready={...row,colleague_response:'accepted',employee_id:'22222222-2222-4222-8222-222222222222',colleague_id:'33333333-3333-4333-8333-333333333333'};
 await withRows([] ,[],[row,ready],async()=>{
  const list=await notices.list(f.sync,f.session,f.db);
  assert.equal(list.length,1);assert.equal(list[0].title,'Troca aguardando aprovação');
 });
});
test('94 notifications: offline and untrusted session never consult central request data',async()=>{
 const f=fixture();f.sync.authenticated=false;
 const list=await notices.list(f.sync,f.session,f.db);assert.deepEqual(list,[]);
 const main=fs.readFileSync(path.join(__dirname,'../desktop/main-next43.cjs'),'utf8');
 assert.ok(main.includes("require('./swap-notices94.cjs')"));
 assert.ok(main.includes("if(action==='readAll')"));
 const ui=fs.readFileSync(path.join(__dirname,'../ui-next/src/main.tsx'),'utf8');
 assert.ok(ui.includes('if(status?.dataChanged)void refreshNotices()'));
});
