'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ops=require('../desktop/shared-ops93.cjs');
const root=path.resolve(__dirname,'..');
const W='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
function mock(){const db={mop_schedule_requests:[],mop_members:[{workspace_id:W,user_id:A,display_name:'Operador A',role:'operator'},{workspace_id:W,user_id:B,display_name:'Operador B',role:'operator'},{workspace_id:W,user_id:C,display_name:'Gestor C',role:'supervisor'},{workspace_id:W,user_id:'44444444-4444-4444-8444-444444444444',display_name:'Leitor',role:'viewer'}]};
 class Query{
  constructor(table){this.table=table;this.filters=[];this.payload=null;this.op='read';this.selected=false}
  select(){this.selected=true;return this}eq(k,v){this.filters.push([k,v]);return this}order(){return this}limit(){return this}
  insert(payload){this.op='insert';this.payload=payload;return this}update(payload){this.op='update';this.payload=payload;return this}
  then(resolve,reject){return Promise.resolve(this.run()).then(resolve,reject)}
  run(){const data=db[this.table]||[],matches=data.filter(x=>this.filters.every(([key,value])=>x[key]===value));
    if(this.op==='insert'){data.push({...this.payload});return {data:null,error:null}}
    if(this.op==='update'){for(const item of matches){Object.assign(item,this.payload);if(this.payload.colleague_response==='declined')item.status='rejected'}return {data:this.selected?matches.map(x=>({...x})):null,error:null}}
    return {data:matches.map(x=>({...x})),error:null}
  }
 }
 function actor(id,role){const session={userId:id,role,mode:'online'};const sync={authenticated:true,userId:id,membership:{workspace_id:W,user_id:id,role},workspace:()=>W,client:{from:table=>new Query(table)}};return {session,sync}}
 return {db,a:actor(A,'operator'),b:actor(B,'operator'),c:actor(C,'supervisor'),viewer:actor('44444444-4444-4444-8444-444444444444','viewer')};
}
test('94: peer directory excludes self and consultation-only accounts',async()=>{
 const f=mock(),list=await ops.requests(f.a.sync,f.a.session,'peers');
 assert.ok(list.some(x=>x.id===B));assert.ok(list.some(x=>x.id===C));
 assert.ok(!list.some(x=>x.id===A));assert.ok(!list.some(x=>x.role==='viewer'));
});
test('94: request validates colleague identity and two different valid dates',async()=>{
 const f=mock(),valid={date:'2026-12-10',colleagueId:B,colleagueDate:'2026-12-11',reason:'Troca autorizada'};
 for(const patch of [{colleagueId:A},{colleagueId:'fake'},{colleagueDate:valid.date},{colleagueDate:'2026-02-30'},{reason:''}]){
  await assert.rejects(ops.requests(f.a.sync,f.a.session,'request',{...valid,...patch}),/Selecione/);
 }
 await assert.rejects(ops.requests(f.viewer.sync,f.viewer.session,'request',valid),/Perfil de consulta/);
 assert.equal(f.db.mop_schedule_requests.length,0);
 const x=await ops.requests(f.a.sync,f.a.session,'request',valid);
 assert.equal(x.scope,'central');assert.equal(f.db.mop_schedule_requests.length,1);
 assert.equal(f.db.mop_schedule_requests[0].colleague_id,B);
});
test('94: only the intended peer can answer and second answer is rejected',async()=>{
 const f=mock(),r=await ops.requests(f.a.sync,f.a.session,'request',{date:'2026-12-10',colleagueId:B,colleagueDate:'2026-12-11',reason:'Troca'});
 await assert.rejects(ops.requests(f.c.sync,f.c.session,'respond',{id:r.id,response:'accepted'}),/não encontrada|já respondida/);
 const response=await ops.requests(f.b.sync,f.b.session,'respond',{id:r.id,response:'accepted'});
 assert.equal(response.colleague_response,'accepted');
 await assert.rejects(ops.requests(f.b.sync,f.b.session,'respond',{id:r.id,response:'declined'}),/não encontrada|já respondida/);
});
test('94: one peer refusal closes request; management cannot approve afterwards',async()=>{
 const f=mock(),r=await ops.requests(f.a.sync,f.a.session,'request',{date:'2026-12-10',colleagueId:B,colleagueDate:'2026-12-11',reason:'Troca'});
 const declined=await ops.requests(f.b.sync,f.b.session,'respond',{id:r.id,response:'declined'});
 assert.equal(declined.status,'rejected');
 await assert.rejects(ops.requests(f.c.sync,f.c.session,'decide',{id:r.id,status:'approved'}),/não encontrada|aceite|decidida/);
 assert.equal(f.db.mop_schedule_requests[0].status,'rejected');
});
test('94: no local fallback for bound cloud schedules and IPC exposes peer response',()=>{
 const main=fs.readFileSync(path.join(root,'desktop/main-next43.cjs'),'utf8');
 assert.match(main,/\['pending','request','decide','peers','inbox','respond'\]/);
 assert.match(main,/\['request','decide','respond'\]/);
 assert.match(main,/Escala central indisponível\. Reconecte ao Supabase/);
});
test('94: SQL enforces multi-party consent, independent manager and four assignments',()=>{
 const sql=fs.readFileSync(path.join(root,'supabase/preview94_bilateral_swap.sql'),'utf8');
 for(const token of ['mop94_peer_respond','mop94_manager_decide','mop94_request_transition','mop94_apply_swap','colleague_response=\'accepted\'','actor is distinct from old.colleague_id','seen<>4','for update','requester_from','requester_to','colleague_from','colleague_to'])assert.ok(sql.includes(token),'Missing: '+token);
 assert.match(sql,/revoke all on function public\.mop_schedule_transition94\(\)/);
 assert.match(sql,/drop trigger if exists mop_schedule_approve93/);
 const ui=fs.readFileSync(path.join(root,'ui-next/src/Schedule70.tsx'),'utf8');
 for(const token of ['Pedidos recebidos','Aguardando aceite do colega','respondSwap','colleagueDate:peerDate','Colaborador da mesma central'])assert.ok(ui.includes(token),'UI missing: '+token);
});
