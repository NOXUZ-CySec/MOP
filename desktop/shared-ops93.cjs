'use strict';
// Preview 93 — authenticated, workspace-scoped Supabase operations.
// Never write local operational tables when this station is bound to the cloud.
const {randomUUID}=require('node:crypto');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const managerRole=role=>role==='admin'||role==='supervisor';
function active(sync,session){return !!(session?.mode==='online'&&sync?.client&&sync?.authenticated&&uuid.test(String(sync.userId||''))&&sync?.membership?.workspace_id===sync.workspace()&&sync?.membership?.user_id===session.userId&&sync?.membership?.role===session.role)}
function identity(sync,session){if(!active(sync,session))throw Error('Sincronização central indisponível. Conecte-se novamente ao Supabase antes de modificar dados compartilhados.');return {workspace:sync.workspace(),userId:sync.userId,manager:managerRole(session.role)};}
function today(){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}
function dateValid(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
function fail(error,label){if(error)throw Error(label+': '+String(error.message||'erro desconhecido'));}
async function checklist(sync,session,operation,input={}){
 const {workspace,userId,manager}=identity(sync,session);
 const tasks=sync.client.from('mop_checklist_tasks'),runs=sync.client.from('mop_checklist_team_runs');
 if(operation==='list'){
  const day=today();const t=await tasks.select('id,title,period,reminder_time,reminder_revision,recurrence,weekday,scheduled_date,enabled,created_by,created_at').eq('workspace_id',workspace).eq('enabled',true).order('period').order('title');fail(t.error,'Falha ao consultar rotinas centrais');
  const r=await runs.select('task_id,completed_by,work_date,completed_at,reminder_revision').eq('workspace_id',workspace).eq('work_date',day);fail(r.error,'Falha ao consultar execuções centrais');
  const versions=new Map((t.data||[]).map(x=>[String(x.id),Number(x.reminder_revision||0)]));return {tasks:t.data||[],runs:(r.data||[]).filter(x=>versions.get(String(x.task_id))===Number(x.reminder_revision||0)),date:day,scope:'central'};
 }
 if(operation==='create'){
  if(!manager)throw Error('Somente supervisores e administradores podem cadastrar rotinas.');
  const title=String(input.title||'').trim(),period=String(input.period||''),reminder_time=require('./reminder97.cjs').parseTime(input.reminder_time),schedule=require('./reminder97.cjs').recurrence(input);
  if(!title||title.length>120||!['Diurno','Noturno','Todos'].includes(period))throw Error('Rotina inválida.');
  const id=randomUUID();const result=await tasks.insert({workspace_id:workspace,id,title,period,reminder_time,...schedule,enabled:true,created_by:userId});fail(result.error,'Falha ao cadastrar rotina central');return {id,scope:'central'};
 }
 if(operation==='edit'){
  if(!manager)throw Error('Somente supervisores e administradores podem editar rotinas.');
  const id=String(input.id||'');
  if(!uuid.test(id))throw Error('Identificação da rotina inválida.');
  const title=String(input.title||'').trim(),period=String(input.period||''),reminder_time=require('./reminder97.cjs').parseTime(input.reminder_time),schedule=require('./reminder97.cjs').recurrence(input);
  if(!title||title.length>120||!['Diurno','Noturno','Todos'].includes(period))throw Error('Rotina inválida.');
  const before=await tasks.select('id,reminder_time,reminder_revision,recurrence,scheduled_date,weekday').eq('workspace_id',workspace).eq('id',id).eq('enabled',true).maybeSingle();fail(before.error,'Falha ao consultar rotina anterior');if(!before.data)throw Error('Rotina indisponível para edição.');const rearm=require('./reminder97.cjs').shouldRearm(before.data,reminder_time);const revision=Number(before.data.reminder_revision||0);const result=await tasks.update({title,period,reminder_time,...schedule,...(rearm?{reminder_revision:revision+1}:{})}).eq('workspace_id',workspace).eq('id',id).eq('enabled',true).eq('reminder_revision',revision).select('id,reminder_revision');
  fail(result.error,'Falha ao editar rotina central');
  if(result.data?.length!==1)throw Error('Rotina indisponível para edição.');
  return {id,updated:true,rescheduled:rearm,reminder_revision:Number(result.data[0].reminder_revision||0),scope:'central'};
 }
 if(operation==='complete'){
  if(session.role==='viewer')throw Error('Perfil de consulta não pode executar rotinas.');
  const id=String(input.id||'');if(!uuid.test(id))throw Error('Rotina inválida.');
  const checked=await tasks.select('id,reminder_revision').eq('workspace_id',workspace).eq('id',id).eq('enabled',true).maybeSingle();fail(checked.error,'Falha ao validar rotina central');if(!checked.data)throw Error('Rotina indisponível.');
  const result=await runs.upsert({workspace_id:workspace,task_id:id,completed_by:userId,work_date:today(),reminder_revision:Number(checked.data.reminder_revision||0)},{onConflict:'workspace_id,task_id,work_date,reminder_revision',ignoreDuplicates:true});
  fail(result.error,'Falha ao concluir rotina para a equipe');
  return {completed:true,scope:'central'};
 }
 if(operation==='disable'){
  if(!manager)throw Error('Somente supervisores e administradores podem desativar rotinas.');
  const id=String(input.id||'');if(!uuid.test(id))throw Error('Rotina inválida.');
  const result=await tasks.update({enabled:false}).eq('workspace_id',workspace).eq('id',id).eq('enabled',true).select('id');fail(result.error,'Falha ao desativar rotina central');if(!result.data?.length)throw Error('Rotina não encontrada ou já desativada.');
  return {disabled:true,scope:'central'};
 }
 throw Error('Operação de checklist inválida.');
}
async function requests(sync,session,operation,input={}){
 const {workspace,userId,manager}=identity(sync,session);
 const table=sync.client.from('mop_schedule_requests');
 if(operation==='peers'){
  const result=await sync.client.from('mop_members').select('user_id,display_name,username,role').eq('workspace_id',workspace);
  fail(result.error,'Falha ao consultar colegas da central');
  return (result.data||[]).filter(x=>x.user_id!==userId&&x.role!=='viewer').map(x=>({id:x.user_id,name:String(x.display_name||x.username||'Colaborador').slice(0,100),role:x.role}));
 }
 if(operation==='inbox'){
  const result=await table.select('id,employee_id,work_date,colleague,colleague_id,colleague_work_date,colleague_response,colleague_responded_at,reason,status,created_at,decided_by,decided_at').eq('workspace_id',workspace).eq('colleague_id',userId).order('created_at',{ascending:false}).limit(100);
  fail(result.error,'Falha ao consultar solicitações recebidas');
  return (result.data||[]).map(x=>({...x,date:x.work_date}));
 }
 if(operation==='load'){
  const employee=manager&&input.employeeId?String(input.employeeId):userId;
  if(!uuid.test(employee))throw Error('Colaborador inválido.');
  const result=await table.select('id,employee_id,work_date,colleague,colleague_id,colleague_work_date,colleague_response,colleague_responded_at,reason,status,created_at,decided_by,decided_at').eq('workspace_id',workspace).eq('employee_id',employee).order('created_at',{ascending:false}).limit(100);
  fail(result.error,'Falha ao consultar solicitações');
  return (result.data||[]).map(x=>({...x,date:x.work_date}));
 }
 if(operation==='pending'){
  if(!manager)throw Error('Acesso exclusivo da supervisão.');
  const result=await table.select('id,employee_id,work_date,colleague,colleague_id,colleague_work_date,colleague_response,reason,status,created_at').eq('workspace_id',workspace).eq('status','pending').order('created_at').limit(100);
  fail(result.error,'Falha ao consultar solicitações pendentes');
  return (result.data||[]).map(x=>({...x,date:x.work_date}));
 }
 if(operation==='request'){
  if(session.role==='viewer')throw Error('Perfil de consulta não pode solicitar troca de escala.');
  const date=String(input.date||''),colleagueId=String(input.colleagueId||''),colleagueDate=String(input.colleagueDate||''),reason=String(input.reason||'').trim();
  if(!dateValid(date)||!dateValid(colleagueDate)||date===colleagueDate||!uuid.test(colleagueId)||colleagueId===userId||!reason||reason.length>500)throw Error('Selecione um colega e duas datas diferentes, com justificativa.');
  const id=randomUUID();
  const result=await table.insert({workspace_id:workspace,id,employee_id:userId,work_date:date,colleague_id:colleagueId,colleague_work_date:colleagueDate,colleague:'Colaborador',reason,status:'pending',colleague_response:'pending'});
  fail(result.error,'Falha ao registrar troca na central');
  return {id,status:'pending',colleague_response:'pending',scope:'central'};
 }
 if(operation==='respond'){
  const id=String(input.id||''),reply=String(input.response||'');
  if(!uuid.test(id)||!['accepted','declined'].includes(reply))throw Error('Resposta à troca inválida.');
  const result=await table.update({colleague_response:reply}).eq('workspace_id',workspace).eq('id',id).eq('colleague_id',userId).eq('status','pending').eq('colleague_response','pending').select('id,status,colleague_response,colleague_responded_at');
  fail(result.error,'Falha ao responder solicitação de troca');
  if(result.data?.length!==1)throw Error('Solicitação não encontrada ou já respondida.');
  return {id,scope:'central',status:result.data[0].status,colleague_response:result.data[0].colleague_response};
 }
 if(operation==='decide'){
  if(!manager)throw Error('Acesso exclusivo da supervisão.');
  const id=String(input.id||''),status=String(input.status||'');
  if(!uuid.test(id)||!['approved','rejected'].includes(status))throw Error('Decisão inválida.');
  // Database enforces independent manager decision and atomically exchanges four assignments.
  let query=table.update({status,decided_by:userId,decided_at:new Date().toISOString()}).eq('workspace_id',workspace).eq('id',id).eq('status','pending');
  if(status==='approved')query=query.eq('colleague_response','accepted');
  const result=await query.select('id,status');
  fail(result.error,'Falha ao decidir solicitação na central');
  if(result.data?.length!==1)throw Error('Solicitação inexistente, ainda sem aceite do colega ou já decidida.');
  return {id,status,scope:'central'};
 }
 throw Error('Operação de solicitação inválida.');
}
module.exports={active,checklist,requests,today,dateValid};