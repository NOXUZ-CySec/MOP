'use strict';
const crypto=require('node:crypto');
const shift=require('../src/shift.js');
const {visible,stampWrite}=require('./operations.cjs');
const handover=require('./handover107.cjs');
const H=require('../src/handover-automation.js');
const WINDOW=12*3600000;
function table(db){db.exec('CREATE TABLE IF NOT EXISTS shift_gate108 (user_id TEXT NOT NULL,shift_id TEXT NOT NULL,delivery_id INTEGER NOT NULL,token TEXT NOT NULL,accepted_at TEXT NOT NULL,PRIMARY KEY(user_id,shift_id))')}
function latest(scope){return scope.handovers.filter(h=>h.automation_version===1&&!h.receipt_at).sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')))[0]}
function gather(state,session,now=new Date()){
 const scope=visible(state,session),current=shift.at(now),incomingStart=Date.parse(current.start_at);
 const delivery=latest(scope);
 const rows=scope.items.filter(x=>!x.deleted_at);
 // All records created in the immediately preceding shift + all still-open critical pending items.
 const created=rows.filter(x=>{const t=Date.parse(x.created_at||x.recorded_at||x.at);return Number.isFinite(t)&&t>=incomingStart-WINDOW&&t<incomingStart});
 const currentRows=rows.filter(x=>{const t=Date.parse(x.created_at||x.recorded_at||x.at);return Number.isFinite(t)&&t>=incomingStart&&t<=+now});
 const open=rows.filter(x=>x.status!=='Resolvido'&&x.status!=='Concluído');
 const critical=open.filter(x=>H.isCritical(x,now));
 const map=new Map();
 for(const x of [...created,...currentRows,...open])map.set(String(x.protocol||x.id),x);
 const items=[...map.values()].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))||String(a.protocol).localeCompare(String(b.protocol))).map(x=>({
  id:String(x.protocol||x.id),title:String(x.subject||x.protocol||'Registro'),condo:String(x.condo||''),category:String(x.category||''),description:String(x.description||''),
  status:String(x.status==='Resolvido'?'Concluído':x.status),priority:String(x.priority||'Normal'),occurredAt:x.created_at||'',version:String(x.updated_at||x.created_at||''),
  critical:critical.includes(x),createdDuringOutgoing:created.includes(x)
 }));
 const token=crypto.createHash('sha256').update(JSON.stringify({shift:current.id,delivery:delivery?.id||0,items:items.map(x=>[x.id,x.version,x.status,x.priority,x.critical])})).digest('hex');
 return {scope,current,delivery,items,token};
}
function snapshot(store,session,now=new Date()){
 table(store.db);
 const x=gather(store.read(),session,now);
 const user=String(session.userId||'');if(!user)throw Error('Usuário sem identificação para recebimento.');
 let row=store.db.prepare('SELECT delivery_id,accepted_at FROM shift_gate108 WHERE user_id=? AND shift_id=?').get(user,x.current.id);
 const received=x.scope.handovers.filter(h=>h.receipt_user_id===user&&h.receipt_slot===x.current.id).sort((a,b)=>String(b.receipt_at||'').localeCompare(String(a.receipt_at||'')))[0];
 if(received&&(!row||row.delivery_id!==received.id)){store.db.prepare('INSERT INTO shift_gate108(user_id,shift_id,delivery_id,token,accepted_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,shift_id) DO UPDATE SET delivery_id=excluded.delivery_id,token=excluded.token,accepted_at=excluded.accepted_at').run(user,x.current.id,received.id,'synced-handover',received.receipt_at||new Date().toISOString());row={delivery_id:received.id,accepted_at:received.receipt_at};}
 const confirmed=!!received&&received.id===row?.delivery_id&&!x.delivery;
 return {shiftId:x.current.id,shiftLabel:x.current.type+' · '+x.current.date,deliveryId:x.delivery?.id||null,outgoing:x.delivery?.outgoing||null,
  deliverySummary:x.delivery?.handover_note||x.delivery?.note||'',selfDelivery:!!x.delivery&&x.delivery.outgoing_identity?.user_id===session.userId,canBootstrap:!x.delivery&&['operator','supervisor','admin'].includes(session.role),
  token:x.token,items:x.items,availableRecords:x.scope.items.length,createdCount:x.items.filter(i=>i.createdDuringOutgoing).length,criticalCount:x.items.filter(i=>i.critical).length,openCount:x.items.filter(i=>i.status!=='Concluído').length,
  accepted:!!row&&confirmed,acceptedAt:confirmed?row?.accepted_at:null};
}
function receive(store,session,input,now=new Date()){
 if(!session||!['operator','supervisor','admin'].includes(session.role))throw Error('Perfil sem permissão para recebimento.');
 table(store.db);
 const uid=String(session.userId||''),current=shift.at(now);
 const previous=store.db.prepare('SELECT delivery_id,accepted_at FROM shift_gate108 WHERE user_id=? AND shift_id=?').get(uid,current.id);
 const x=gather(store.read(),session,now);
 const received=x.scope.handovers.filter(h=>h.receipt_user_id===uid&&h.receipt_slot===current.id).sort((a,b)=>String(b.receipt_at||'').localeCompare(String(a.receipt_at||'')))[0];
 if(received&&!x.delivery){const acceptedAt=previous?.accepted_at||received.receipt_at||now.toISOString();if(!previous)store.db.prepare('INSERT INTO shift_gate108(user_id,shift_id,delivery_id,token,accepted_at) VALUES(?,?,?,?,?)').run(uid,current.id,received.id,'recovered',acceptedAt);return {accepted:true,alreadyAccepted:true,deliveryId:received.id,acceptedAt};}
 if(!x.delivery&&!input.bootstrap)throw Error('Nenhuma entrega pendente foi encontrada. Atualize a conferência ou registre o início sem entrega anterior.');
 if(!x.delivery&&input.bootstrap){
  const note='Início sem entrega anterior registrada; conferência operacional confirmada.';
  if(input.shiftId!==current.id||input.token!==x.token)throw Error('Dados do turno alterados. Atualize a conferência.');
  const ids=input.confirmedIds;
  if(!Array.isArray(ids)||ids.length!==x.items.length||new Set(ids).size!==x.items.length||x.items.some(y=>!ids.includes(y.id)))throw Error('Confirme individualmente todos os registros.');
  const critical=x.items.filter(y=>y.critical);if(critical.some(y=>input.readVersions?.[y.id]!==y.version))throw Error('Pendência crítica desatualizada.');
  const before=store.read(),scope=visible(before,session),at=now.toISOString();
  const pending=scope.items.filter(y=>!y.deleted_at&&y.status!=='Resolvido');
  const row={id:before.nextHandover,at,delivered_at:null,automation_version:1,receipt_at:at,receipt_slot:current.id,receipt_note:note,receipt_override:false,critical_protocols:critical.map(y=>y.id),read_versions:Object.fromEntries(critical.map(y=>[y.id,y.version])),note:'Início sem entrega anterior.',handover_note:'Início sem entrega anterior: '+note,open_ids:JSON.stringify(pending.map(y=>y.id)),snapshot:pending.map(y=>structuredClone(y))};
  const next=structuredClone(scope);next.handovers.push(row);const written=stampWrite(before,next,session,at);store.write(written);
  store.db.prepare('INSERT INTO shift_gate108(user_id,shift_id,delivery_id,token,accepted_at) VALUES(?,?,?,?,?)').run(uid,current.id,row.id,x.token,at);
  return {accepted:true,deliveryId:row.id,bootstrap:true,acceptedAt:at};
 }
 if(x.delivery.outgoing_identity?.user_id===uid)throw Error('Você não pode receber a própria entrega de turno.');
 if(Number(input.deliveryId)!==x.delivery.id||input.token!==x.token||input.shiftId!==current.id)throw Error('Dados da passagem alterados. Atualize a conferência.');
 const ids=input.confirmedIds;
 if(!Array.isArray(ids)||ids.length!==x.items.length||new Set(ids).size!==x.items.length||x.items.some(item=>!ids.includes(item.id)))throw Error('Confirme individualmente todos os registros apresentados.');
 const versions=input.readVersions||{};
 const critical=x.items.filter(y=>y.critical);
 if(critical.some(item=>versions[item.id]!==item.version))throw Error('As pendências críticas mudaram. Atualize a conferência.');
 // Commit receipt once. If a crash occurs between receipt and gate bookkeeping,
 // the next call can finalize the bookkeeping without a second handover.
 const result=handover.checkout(store,session,'receive',{deliveryId:x.delivery.id,receiptNote:String(input.note||'').slice(0,1500),readVersions:Object.fromEntries(critical.map(y=>[y.id,y.version])),receiptSlot:current.id},now.toISOString());
 const acceptedAt=now.toISOString();
 store.db.prepare('INSERT INTO shift_gate108(user_id,shift_id,delivery_id,token,accepted_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,shift_id) DO UPDATE SET delivery_id=excluded.delivery_id, token=excluded.token, accepted_at=excluded.accepted_at').run(uid,current.id,x.delivery.id,x.token,acceptedAt);
 return {accepted:true,deliveryId:result.id,acceptedAt};
}
function history(store,session){
 if(!['supervisor','admin'].includes(session?.role))throw Error('Histórico de recebimentos restrito à supervisão.');
 const rows=visible(store.read(),session).handovers.filter(h=>h.receipt_at).map(h=>({id:h.id,shift_id:h.receipt_slot||shift.at(new Date(h.receipt_at)).id,user_id:String(h.receipt_user_id||h.incoming_identity?.user_id||''),operator:String(h.incoming||h.incoming_identity?.display_name||'Não informado'),received_at:h.receipt_at,kind:h.delivered_at?'Recebimento de turno':'Início sem entrega anterior',delivery_at:h.delivered_at||null,outgoing:String(h.outgoing||''),note:String(h.receipt_note||''),source:'MOP'}));
 return rows.sort((a,b)=>String(b.received_at).localeCompare(String(a.received_at))).slice(0,300);
}
module.exports={snapshot,receive,gather,history};
