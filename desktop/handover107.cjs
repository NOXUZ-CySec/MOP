'use strict';
const {visible,stampWrite}=require('./operations.cjs');
const H=require('../src/handover-automation.js');
const I=require('../src/intelligence.js');
const SHIFT=require('../src/shift.js');
const canEditContinuity=(row,session)=>['supervisor','admin'].includes(session?.role)||(session?.role==='operator'&&row.created_identity?.user_id===session.userId);
const protocol=row=>String(row.protocol||row.id);
const text=value=>String(value??'').trim();
const checkout=(store,session,command,input={},now=new Date().toISOString())=>{
 if(!session?.userId||!['operator','supervisor','admin'].includes(session.role))throw Error('Perfil sem permissão para passagem.');
 const before=store.read(),scope=visible(before,session);
 if(command==='assignPending'){
  const target=scope.items.find(row=>protocol(row)===String(input.protocol)&&!row.deleted_at&&row.status!=='Resolvido'&&row.status!=='Concluído');
  if(!target)throw Error('Pendência indisponível ou fora do seu acesso. Atualize a passagem.');
  if(!canEditContinuity(target,session))throw Error('Somente o autor do registro ou a supervisão pode alterar as orientações de continuidade.');
  if(typeof input.readVersion!=='string'||!input.readVersion||input.readVersion!==H.version(target))throw Error('A pendência foi alterada. Atualize e revise as orientações antes de salvar.');
  if(typeof input.assignee!=='string'||typeof input.nextAction!=='string'||input.assignee.length>160||input.nextAction.length>1000)throw Error('Informe responsável (até 160 caracteres) e próxima ação (até 1000 caracteres).');
  const assignee=input.assignee.trim(),nextAction=input.nextAction.trim();
  if(assignee===text(target.assignee)&&nextAction===text(target.next_action))return {id:target.id,protocol:protocol(target),action:'assignPending',changed:false,readVersion:H.version(target),at:now};
  // A second write in the same millisecond must not reuse the optimistic-lock version.
  const previous=Date.parse(H.version(target)),requested=Date.parse(now);
  const at=Number.isFinite(previous)&&previous>=requested?new Date(previous+1).toISOString():now;
  const next=structuredClone(scope),row=next.items.find(item=>item.id===target.id);
  if(assignee!==text(row.assignee))delete row.assignee_user_id;
  row.assignee=assignee;row.next_action=nextAction;
  const event={id:before.nextEvent,item_id:row.id,at,kind:'Continuidade do turno',detail:'Responsável: '+(assignee||'Não informado')+'\nPróxima ação: '+(nextAction||'Não informada'),source:'Passagem de Turno'};
  next.events.push(event);next.nextEvent=before.nextEvent+1;
  const written=stampWrite(before,next,session,at);
  // Reuse the same audit integration as record-actions96; no new storage shape.
  const previousAudit=store.intelligence;
  if(!previousAudit)store.intelligence=new (require('./intelligence.cjs').Intelligence)(store);
  try{store.write(written,session);}finally{if(!previousAudit)delete store.intelligence;}
  return {id:row.id,protocol:protocol(row),action:'assignPending',changed:true,readVersion:H.version(written.items.find(item=>item.id===row.id)),at};
 }
 if(command==='deliver'){
  if(typeof input.summary!=='string'||input.summary.length>1000)throw Error('Resumo opcional da entrega (até 1000 caracteres).');
  if(!Array.isArray(input.checklist)||!['pending','deadlines','continuity'].every(k=>input.checklist.includes(k)))throw Error('Confirme os três itens da conferência de entrega.');
  if(input.reviewToken!==H.token(before,session))throw Error('Pendências alteradas. Atualize antes de entregar.');
  if(scope.handovers.some(h=>!h.receipt_at&&h.automation_version===1))throw Error('Existe uma entrega pendente de recebimento.');
  const open=H.analyze(before,session,new Date(now)).open;
  const row={id:before.nextHandover,at:now,delivered_at:now,note:input.summary.trim(),handover_note:input.summary.trim(),open_ids:JSON.stringify(open.map(x=>x.id)),snapshot:open.map(x=>structuredClone(x)),condo:Array.isArray(session.condos)&&session.condos.length===1?session.condos[0]:undefined,automation_version:1,review_token:input.reviewToken,delivery_checklist:input.checklist};
  const next=structuredClone(scope);next.handovers.push(row);
  const written=stampWrite(before,next,session,now);store.write(written,session);
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
  const written=stampWrite(before,next,session,now);store.write(written,session);
  return {id:row.id,action:'receive',at:now};
 }
 throw Error('Comando desconhecido para passagem de turno.');
};
function itemView(row,session,now,readOnly=false){
 const readVersion=H.version(row),assignee=text(row.assignee),nextAction=text(row.next_action),deadline=text(row.deadline)||null;
 const due=I.stamp(deadline),updated=I.stamp(readVersion),critical=H.isCritical(row,now);
 return {id:protocol(row),title:row.subject||protocol(row),description:row.description||'',
  status:['Resolvido','Concluído'].includes(row.status)?'Concluído':row.status==='Em andamento'?'Em andamento':'Pendente',
  category:row.category||'Operação',occurredAt:row.updated_at||row.created_at||'',priority:critical?'Urgente':'Normal',critical,
  assignee,nextAction,readVersion,condo:row.condo||'',deadline,actionTaken:row.action_taken||'',sourcePriority:row.priority||'Normal',
  updatedAt:readVersion,missingAssignee:!assignee,missingNextAction:!nextAction,
  overdue:Number.isFinite(due)&&due<+now,dueSoon:Number.isFinite(due)&&due>=+now&&due<=+now+12*3600000,
  stale:Number.isFinite(updated)&&+now-updated>=60*60000,
  canEditContinuity:!readOnly&&!row.deleted_at&&!['Resolvido','Concluído'].includes(row.status)&&!!readVersion&&canEditContinuity(row,session)};
}
function snapshot(store,session,now=new Date()){
 const state=store.read(),scope=visible(state,session),plan=H.analyze(state,session,now);
 const last=scope.handovers.filter(h=>!h.receipt_at&&h.automation_version===1).sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')))[0],shift=SHIFT.at(now);
 const pending=last&&last.outgoing_identity?.user_id===session.userId;
 const deliveredAt=last?.delivered_at||last?.at||null;
 const deliveryDate=deliveredAt&&Number.isFinite(Date.parse(deliveredAt))?new Date(deliveredAt):null;
 const deliveredShift=deliveryDate?SHIFT.at(deliveryDate):null;
 const items=plan.open.map(row=>itemView(row,session,now));
 const originals=Array.isArray(last?.snapshot)?last.snapshot.filter(row=>row&&typeof row==='object'):[];
 const deliveredItems=originals.map(row=>itemView(row,session,deliveryDate||now,true));
 const changes=[];
 if(last){
  const originalMap=new Map(originals.map(row=>[protocol(row),row]));
  const currentMap=new Map(scope.items.filter(row=>!row.deleted_at).map(row=>[protocol(row),row]));
  for(const original of originals){
   const id=protocol(original),current=currentMap.get(id),deliveredVersion=H.version(original);
   if(!current)changes.push({id,kind:'unavailable',deliveredVersion});
   else if(['Resolvido','Concluído'].includes(current.status))changes.push({id,kind:'resolved',deliveredVersion,currentVersion:H.version(current)});
   else if(H.token({items:[original]},session)!==H.token({items:[current]},session))changes.push({id,kind:'updated',deliveredVersion,currentVersion:H.version(current)});
  }
  for(const current of plan.open)if(!originalMap.has(protocol(current)))changes.push({id:protocol(current),kind:'added',currentVersion:H.version(current)});
 }
 return {reviewToken:H.token(state,session),items,
  counts:{...plan.counts,missingAssignee:items.filter(row=>row.missingAssignee).length,missingNextAction:items.filter(row=>row.missingNextAction).length,continuityReady:items.filter(row=>!row.missingAssignee&&!row.missingNextAction).length,changedSinceDelivery:changes.length},
  shiftId:shift.id,updatedAt:now.toISOString(),deliveredAt,
  deliveredShift:deliveredShift?{id:deliveredShift.id,type:deliveredShift.type,date:deliveredShift.date,period:deliveredShift.type==='Diurno'?'06:00 – 18:00':'18:00 – 06:00'}:null,
  deliveredItems,changes,receiptNote:'',
  deliveryId:last?.id||undefined,deliverySummary:last?.handover_note||last?.note||'',stage:last?(pending?'awaiting-receipt':'receipt'):'delivery',
  outgoing:last?.outgoing||session.display_name,incoming:last?.incoming||null,shift:shift.type,date:shift.date,period:shift.type==='Diurno'?'06:00 – 18:00':'18:00 – 06:00'};
}
// Read only: use the existing authorized scope and the actual receipt for this user/shift.
function briefing(store,session,now=new Date()){
 if(!session?.userId||!['operator','supervisor','admin'].includes(session.role))throw Error('Perfil sem acesso ao briefing.');
 const scope=visible(store.read(),session),current=SHIFT.at(now),previous=SHIFT.at(new Date(Date.parse(current.start_at)-1));
 const receipt=scope.handovers.filter(h=>h.automation_version===1&&h.receipt_at&&h.receipt_user_id===session.userId&&h.receipt_slot===current.id).sort((a,b)=>String(b.receipt_at).localeCompare(String(a.receipt_at)))[0];
 const rows=scope.items.filter(r=>!r.deleted_at),start=Date.parse(previous.start_at),end=Date.parse(previous.end_at);
 const created=rows.filter(r=>{const at=I.stamp(r.created_at);return Number.isFinite(at)&&at>=start&&at<end});
 const closed=r=>['Resolvido','Conclu\u00eddo'].includes(r.status);
 const items=rows.filter(r=>!closed(r)).map(r=>itemView(r,session,now,true));
 const delivery=receipt?.delivered_at?{id:receipt.id,at:receipt.delivered_at,outgoing:receipt.outgoing||'',summary:receipt.handover_note||receipt.note||'',receivedAt:receipt.receipt_at}:null;
 return {current,previous,delivery,received:!!receipt,createdIds:created.map(protocol),createdCount:created.length,closedNow:created.filter(closed).length,openNow:created.filter(r=>!closed(r)).length,items};
}
module.exports={checkout,snapshot,briefing};
