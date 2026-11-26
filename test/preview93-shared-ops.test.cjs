'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ops=require('../desktop/shared-ops93.cjs');
const workspace='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const operatorId='11111111-1111-4111-8111-111111111111';
const managerId='22222222-2222-4222-8222-222222222222';
const colleagueId='33333333-3333-4333-8333-333333333333';
class Query{
 constructor(db,table){this.db=db;this.table=table;this.filters=[];this.mode='read';this.payload=null;this.selected=false;this.limitN=1000}
 select(){this.selected=true;return this}
 eq(key,value){this.filters.push([key,value]);return this}
 order(){return this}
 limit(n){this.limitN=n;return this}
 insert(value){this.mode='insert';this.payload=value;return this}
 upsert(value,{onConflict,ignoreDuplicates=false}={}){
  this.mode='upsert';this.payload=value;this.conflictKeys=onConflict?.split(',')||[];this.ignoreDuplicates=ignoreDuplicates;
  assert.ok(this.conflictKeys.length,'fixture requires an explicit conflict key');
  return this;
 }
 update(value){this.mode='update';this.payload=value;return this}
 async maybeSingle(){const r=await this.execute();return {...r,data:r.data?.[0]||null}}
 then(resolve,reject){return Promise.resolve(this.execute()).then(resolve,reject)}
 execute(){const rows=this.db[this.table]||=[];
 if(this.mode==='upsert'){
  const row=rows.find(candidate=>this.conflictKeys.every(key=>candidate[key]===this.payload[key]));
  if(row&&this.ignoreDuplicates)return {data:this.selected?[]:null,error:null};
  if(row)Object.assign(row,this.payload);else rows.push({...this.payload});
  return {data:this.selected?[{...this.payload}]:null,error:null};
 }
 if(this.mode==='insert'){
  if(this.table==='mop_checklist_runs'&&rows.some(x=>x.workspace_id===this.payload.workspace_id&&x.task_id===this.payload.task_id&&x.user_id===this.payload.user_id&&x.work_date===this.payload.work_date))return {data:null,error:{code:'23505',message:'duplicate'}};
  rows.push({...this.payload});return {data:this.selected?[{...this.payload}]:null,error:null};
 }
 const matches=rows.filter(x=>this.filters.every(([k,v])=>x[k]===v)).slice(0,this.limitN);
 if(this.mode==='update'){for(const row of matches)Object.assign(row,this.payload);return {data:this.selected?matches.map(x=>({...x})):null,error:null}}
 return {data:matches.map(x=>({...x})),error:null};
 }
}
function fixture(){const db={mop_checklist_tasks:[],mop_checklist_team_runs:[],mop_schedule_requests:[],mop_members:[{workspace_id:workspace,user_id:operatorId,display_name:'Solicitante',role:'operator'},{workspace_id:workspace,user_id:colleagueId,display_name:'Colega',role:'operator'},{workspace_id:workspace,user_id:managerId,display_name:'Gestor',role:'supervisor'}]};
 function account(role,id){const sync={authenticated:true,userId:id,membership:{user_id:id,role,workspace_id:workspace},workspace:()=>workspace,client:{from:table=>new Query(db,table)}};const session={userId:id,role,mode:'online'};return {sync,session}}
 return {db,operator:account('operator',operatorId),colleague:account('operator',colleagueId),manager:account('supervisor',managerId),viewer:account('viewer',operatorId)};
}
test('Preview93 shared checklist is consistent across two accounts and idempotent',async()=>{
 const f=fixture();assert.equal(ops.active(f.manager.sync,f.manager.session),true);
 const created=await ops.checklist(f.manager.sync,f.manager.session,'create',{title:'Conferir gravações',period:'Todos'});
 assert.equal(created.scope,'central');const list=await ops.checklist(f.operator.sync,f.operator.session,'list');
 assert.equal(list.tasks.length,1);assert.equal(list.tasks[0].title,'Conferir gravações');
 assert.deepEqual(list.runs,[]);
 await ops.checklist(f.operator.sync,f.operator.session,'complete',{id:created.id});
 await ops.checklist(f.colleague.sync,f.colleague.session,'complete',{id:created.id});
 const after=await ops.checklist(f.operator.sync,f.operator.session,'list');
 assert.equal(after.runs.length,1);
 assert.equal(after.runs[0].task_id,created.id);
 assert.equal(after.runs[0].completed_by,operatorId);
 const team=await ops.checklist(f.manager.sync,f.manager.session,'list');
 assert.deepEqual(team.runs,after.runs);
 assert.equal(f.db.mop_checklist_team_runs.length,1);
 await ops.checklist(f.manager.sync,f.manager.session,'disable',{id:created.id});
 assert.equal((await ops.checklist(f.operator.sync,f.operator.session,'list')).tasks.length,0);
 await assert.rejects(ops.checklist(f.operator.sync,f.operator.session,'complete',{id:created.id}),/indisponível/);
});
test('Preview93 keeps checklist creation and swap approval restricted by role',async()=>{
 const f=fixture();await assert.rejects(ops.checklist(f.operator.sync,f.operator.session,'create',{title:'Teste',period:'Todos'}),/Somente supervisores/);
 await assert.rejects(ops.checklist(f.viewer.sync,f.viewer.session,'complete',{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}),/Perfil de consulta/);
 await assert.rejects(ops.requests(f.operator.sync,f.operator.session,'pending'),/supervisão/);
 await assert.rejects(ops.requests(f.operator.sync,f.operator.session,'decide',{id:workspace,status:'approved'}),/supervisão/);
});
test('Preview94 request awaits colleague before independent manager approval',async()=>{
 const f=fixture(),date='2026-11-24';
 const peers=await ops.requests(f.operator.sync,f.operator.session,'peers');assert.ok(peers.some(x=>x.id===colleagueId));
 const initial=await ops.requests(f.operator.sync,f.operator.session,'request',{date,colleagueId,colleagueDate:'2026-11-25',reason:'Troca de folga'});
 assert.equal(initial.status,'pending');
 const own=await ops.requests(f.operator.sync,f.operator.session,'load');
 assert.equal(own.length,1);assert.equal(own[0].date,date);
 const received=await ops.requests(f.colleague.sync,f.colleague.session,'inbox');
 assert.equal(received.length,1);assert.equal(received[0].colleague_id,colleagueId);
 const premature=await assert.rejects(ops.requests(f.manager.sync,f.manager.session,'decide',{id:initial.id,status:'approved'}),/aceite|decidida/i);
 const response=await ops.requests(f.colleague.sync,f.colleague.session,'respond',{id:initial.id,response:'accepted'});
 assert.equal(response.colleague_response,'accepted');
 const decision=await ops.requests(f.manager.sync,f.manager.session,'decide',{id:initial.id,status:'approved'});
 assert.equal(decision.scope,'central');assert.equal(decision.status,'approved');
 const pending=await ops.requests(f.manager.sync,f.manager.session,'pending');assert.equal(pending.length,0);
 await assert.rejects(ops.requests(f.manager.sync,f.manager.session,'decide',{id:initial.id,status:'rejected'}),/decidida/i);
 const sql=fs.readFileSync(path.join(__dirname,'../supabase/preview94_bilateral_swap.sql'),'utf8');
 assert.match(sql,/create trigger mop94_apply_swap after update/);
 assert.match(sql,/colleague_response='accepted'/);
});
test('Preview93 fails closed on offline, revoked or role-switched session',async()=>{
 const f=fixture();f.operator.session.mode='offline';assert.equal(ops.active(f.operator.sync,f.operator.session),false);
 await assert.rejects(ops.checklist(f.operator.sync,f.operator.session,'list'),/Sincronização central indisponível/);
 f.operator.session.mode='online';f.operator.sync.membership.role='viewer';
 await assert.rejects(ops.requests(f.operator.sync,f.operator.session,'request',{date:'2026-11-24',colleague:'Y',reason:'Teste'}),/Sincronização central indisponível/);
 f.operator.sync.membership.role='operator';f.operator.sync.authenticated=false;
 assert.equal(ops.active(f.operator.sync,f.operator.session),false);
});
test('Preview93 validates dates, free-text fields and Brazilian completion date',async()=>{
 assert.equal(ops.dateValid('2026-02-29'),false);assert.equal(ops.dateValid('2028-02-29'),true);
 assert.match(ops.today(),/^\d{4}-\d{2}-\d{2}$/);
 const f=fixture();await assert.rejects(ops.requests(f.operator.sync,f.operator.session,'request',{date:'2026-02-30',colleagueId,colleagueDate:'2026-03-01',reason:'Teste'}),/Selecione/);
 await assert.rejects(ops.checklist(f.manager.sync,f.manager.session,'create',{title:'',period:'Todos'}),/inválida/);
});
test('Preview93 realtime and client IPC use authenticated, non-looping updates',()=>{
 const root=path.resolve(__dirname,'..');const main=fs.readFileSync(path.join(root,'desktop/main-next43.cjs'),'utf8');const sync=fs.readFileSync(path.join(root,'desktop/sync-engine.cjs'),'utf8');
 assert.match(main,/if\(action!=='list'\)sync\.emit\(true\)/);
 assert.match(main,/shared\.requests\(sync,session,'load',input\)/);
 assert.match(main,/await central\.action\(sync,store,session,'load',\{employeeId,month\}\)/);
 for(const table of ['mop_schedule_days','mop_checklist_tasks','mop_checklist_runs','mop_schedule_requests'])assert.ok(sync.includes("table:'"+table+"'"));
 assert.ok(main.includes('Escala central indisponível. Reconecte ao Supabase'));
});