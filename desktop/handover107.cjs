'use strict';
const {visible,stampWrite}=require('./operations.cjs');
const H=require('../src/handover-automation.js');
const SHIFT=require('../src/shift.js');
const checkout=(store,session,command,input={},now=new Date().toISOString())=>{
 if(!session||!['operator','supervisor','admin'].includes(session.role))throw Error('Perfil sem permissão para passagem.');
 const before=store.read(),scope=visible(before,session);
 if(command==='deliver'){
  if(typeof input.summary!=='string'||!input.summary.trim()||input.summary.length>1000)throw Error('Informe o resumo da entrega (até 1000 caracteres).');
  if(!Array.isArray(input.checklist)||!['pending','deadlines','continuity'].every(k=>input.checklist.includes(k)))throw Error('Confirme os três itens da conferência de entrega.');
  if(input.reviewToken!==H.token(before,session))throw Error('Pendências alteradas. Atualize antes de entregar.');
  if(scope.handovers.some(h=>!h.receipt_at&&h.automation_version===1))throw Error('Existe uma entrega pendente de recebimento.');
  const open=H.analyze(before,session,new Date(now)).open;
  const row={id:before.nextHandover,at:now,delivered_at:now,note:input.summary.trim(),handover_note:input.summary.trim(),open_ids:JSON.stringify(open.map(x=>x.id)),snapshot:open.map(x=>structuredClone(x)),condo:Array.isArray(session.condos)&&session.condos.length===1?session.condos[0]:undefined,automation_version:1,review_token:input.reviewToken,delivery_checklist:input.checklist};
  const next=structuredClone(scope);next.handovers.push(row);
  const written=stampWrite(before,next,session,now);store.write(written);
  return {id:row.id,action:'deliver',at:now};
 }
 if(command==='receive'){
  const target=scope.handovers.find(h=>h.id===Number(input.deliveryId));
  if(!target||target.receipt_at)throw Error('Entrega indisponível ou já recebida. Atualize a passagem.');
  if(target.outgoing_identity?.user_id===session.userId)throw Error('O mesmo usuário não pode entregar e receber.');
  const critical=H.analyze(before,session,new Date(now)).critical;
  const versions=input.readVersions||{};
  if(critical.some(x=>versions[x.protocol]!==H.version(x)))throw Error('Revise todas as pendências críticas na versão atual.');
  const next=structuredClone(scope);const row=next.handovers.find(h=>h.id===target.id);
  row.receipt_at=now;row.receipt_slot=input.receiptSlot||SHIFT.at(new Date(now)).id;row.receipt_note=String(input.receiptNote||'').slice(0,1500);row.critical_protocols=critical.map(x=>x.protocol);row.read_versions=Object.fromEntries(critical.map(x=>[x.protocol,H.version(x)]));
  const written=stampWrite(before,next,session,now);store.write(written);
  return {id:row.id,action:'receive',at:now};
 }
 throw Error('Comando desconhecido para passagem de turno.');
};
function snapshot(store,session,now=new Date()){
 const state=store.read(),scope=visible(state,session),plan=H.analyze(state,session,now),last=scope.handovers.filter(h=>!h.receipt_at&&h.automation_version===1).sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')))[0],shift=SHIFT.at(now);
 const pending=last&&last.outgoing_identity?.user_id===session.userId;
 return {reviewToken:H.token(state,session),
  items:plan.open.map(x=>({id:x.protocol,title:x.subject||x.protocol,description:x.description||'',status:x.status==='Resolvido'?'Concluído':x.status==='Em andamento'?'Em andamento':'Pendente',category:x.category||'Operação',occurredAt:x.updated_at||x.created_at,priority:['Urgente','Crítica','Alta'].includes(x.priority)?'Urgente':'Normal',critical:plan.critical.some(y=>y.protocol===x.protocol),assignee:x.assignee||'A definir',nextAction:x.next_action||'Acompanhar',readVersion:H.version(x)})),
  deliveryId:last?.id||undefined,deliverySummary:last?.note||'',stage:last?(pending?'awaiting-receipt':'receipt'):'delivery',outgoing:last?.outgoing||session.display_name,incoming:last?.incoming||null,shift:shift.type,date:shift.date,period:shift.type==='Diurno'?'06:00 – 18:00':'18:00 – 06:00'};
}
module.exports={checkout,snapshot};
