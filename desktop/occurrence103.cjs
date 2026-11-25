'use strict';
const {visible}=require('./operations.cjs');
const {randomUUID}=require('node:crypto');
const roles=new Set(['admin','supervisor']);
const priorities=new Set(['Baixa','Normal','Alta','Crítica']);
function ensureRecord(store,session,id){
 const row=visible(store.read(),session).items.find(x=>String(x.protocol||x.id)===String(id)&&!x.deleted_at);
 if(!row)throw Error('Registro inexistente ou fora do seu acesso.');
 return row;
}
async function action(sync,store,session,operation,input={}){
 const shared=require('./shared-ops93.cjs');
 if(!shared.active(sync,session))throw Error('Acompanhamento central indisponível. Reconecte ao Supabase; nenhuma alteração local será realizada.');
 const workspace=sync.workspace(),uid=session.userId,client=sync.client;
 const base=client.from('mop_occurrence_tracking'),notes=client.from('mop_occurrence_updates');
 const fail=(error,label)=>{if(error)throw Error(label+': '+error.message)};
 if(operation==='list'){
  const result=await base.select('record_protocol,condo,priority,assigned_user_id,updated_by,updated_at').eq('workspace_id',workspace);
  fail(result.error,'Falha ao consultar acompanhamento');
  const n=await notes.select('id,record_protocol,note,author_id,created_at').eq('workspace_id',workspace).order('created_at',{ascending:false}).limit(1000);
  fail(n.error,'Falha ao consultar providências');
  const members=roles.has(session.role)?await client.from('mop_members').select('user_id,display_name,username,condos,role').eq('workspace_id',workspace):{data:[],error:null};
  fail(members.error,'Falha ao consultar colaboradores');
  const scoped=new Set(visible(store.read(),session).items.filter(x=>!x.deleted_at).map(x=>String(x.protocol||x.id)));
  return {tracking:(result.data||[]).filter(x=>scoped.has(x.record_protocol)),updates:(n.data||[]).filter(x=>scoped.has(x.record_protocol)),statusHistory:require('./occurrence108.cjs').statusHistory(store,session),members:(members.data||[]).filter(x=>x.role!=='viewer'&&(session.condos==null||x.condos==null||x.condos.some(c=>session.condos.includes(c))))};
 }
 const id=String(input.id||'');
 const record=ensureRecord(store,session,id);
 const condo=String(record.condo);
 if(operation==='status'){
  if(session.role==='viewer')throw Error('Seu perfil não permite atualizar status.');
  const to=String(input.status||'');
  if(!['Pendente','Em andamento','Resolvido'].includes(to))throw Error('Status inválido.');
  if(record.status==='Resolvido'&&to!=='Resolvido'&&!roles.has(session.role))throw Error('Somente a supervisão pode reabrir ocorrências.');
  if(to===record.status)return {saved:true,unchanged:true};
  const {stampWrite}=require('./operations.cjs');const current=store.read();const next=structuredClone(current);const target=next.items.find(x=>String(x.protocol||x.id)===id);if(!target||target.deleted_at)throw Error('Registro não disponível.');target.status=to;const written=stampWrite(current,next,session);const previous=store.intelligence;if(!previous)store.intelligence=new (require('./intelligence.cjs').Intelligence)(store);try{store.write(written,session)}finally{if(!previous)delete store.intelligence}return {saved:true,status:to};
 }
 if(operation==='note'){
  if(session.role==='viewer')throw Error('Seu perfil não permite registrar providências.');
  const note=String(input.note||'').trim();
  if(note.length<4||note.length>2000)throw Error('Informe uma providência entre 4 e 2000 caracteres.');
  const result=await notes.insert({id:randomUUID(),workspace_id:workspace,record_protocol:id,condo,note,author_id:uid});
  fail(result.error,'Falha ao registrar providência');
  return {saved:true};
 }
 if(operation==='assign'){
  if(!roles.has(session.role))throw Error('Atribuição e prioridade são restritas à supervisão.');
  const priority=String(input.priority||'Normal');
  if(!priorities.has(priority))throw Error('Prioridade inválida.');
  const assignee=input.assigned_user_id||null;
  if(assignee){
   const m=await client.from('mop_members').select('user_id,condos,role').eq('workspace_id',workspace).eq('user_id',assignee).maybeSingle();
   fail(m.error,'Falha ao validar responsável');
   if(!m.data||m.data.role==='viewer'||m.data.condos!=null&&!m.data.condos.includes(condo))throw Error('Responsável não autorizado para a unidade.');
  }
  const result=await base.upsert({workspace_id:workspace,record_protocol:id,condo,priority,assigned_user_id:assignee,updated_by:uid,updated_at:new Date().toISOString()},{onConflict:'workspace_id,record_protocol'}).select('record_protocol');
  fail(result.error,'Falha ao atualizar ocorrência');
  if(result.data?.length!==1)throw Error('Central não confirmou a alteração.');
  return {saved:true};
 }
 throw Error('Operação de ocorrência inválida.');
}
module.exports={action,ensureRecord};
