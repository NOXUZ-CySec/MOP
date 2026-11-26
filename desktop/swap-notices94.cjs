'use strict';
// Preview94 — in-app notifications derived from the authenticated central queue.
// No new local business-state table; read markers reuse intelligence_seen per user.
const shared=require('./shared-ops93.cjs');
const keyFor=(kind,row,phase)=>'swap94:'+kind+':'+row.id+':'+phase;
function asNotice(kind,row,phase,title,detail){
 return {key:keyFor(kind,row,phase),type:'shift',target:'schedule',severity:['pending','ready'].includes(phase)?'warning':'info',title,detail,
         at:row.decided_at||row.colleague_responded_at||row.created_at||new Date().toISOString(),active:true};
}
async function list(sync,session,db){
 if(!shared.active(sync,session))return [];
 const [own,inbox,pending]=await Promise.all([
  shared.requests(sync,session,'load'),
  shared.requests(sync,session,'inbox'),
  ['admin','supervisor'].includes(session.role)?shared.requests(sync,session,'pending'):Promise.resolve([])
 ]);
 const notices=[];
 for(const row of inbox){
  if(row.status==='pending'&&row.colleague_response==='pending'){
   notices.push(asNotice('peer',row,'pending','Troca aguardando seu aceite','Confira o pedido de troca e responda na aba Escala de Trabalho.'));
  }else if(row.status==='approved'){
   notices.push(asNotice('peer',row,'approved','Troca aprovada','A escala foi atualizada para os dois colaboradores.'));
  }else if(row.status==='rejected'&&row.colleague_response!=='declined'){
   notices.push(asNotice('peer',row,'rejected','Troca recusada pela supervisão','A solicitação foi encerrada sem alterar a escala.'));
  }
 }
 for(const row of own){
  if(row.status==='approved')notices.push(asNotice('author',row,'approved','Troca aprovada','A escala foi atualizada para os dois colaboradores.'));
  else if(row.status==='rejected')notices.push(asNotice('author',row,'rejected','Troca não autorizada',row.colleague_response==='declined'?'O colega recusou a solicitação.':'A supervisão recusou a solicitação.'));
  else if(row.colleague_response==='accepted')notices.push(asNotice('author',row,'accepted','Colega aceitou sua troca','O pedido está aguardando a decisão da supervisão.'));
 }
 for(const row of pending){
  if(row.colleague_response==='accepted'&&session.userId!==row.employee_id&&session.userId!==row.colleague_id){
   notices.push(asNotice('manager',row,'ready','Troca aguardando aprovação','Os dois colaboradores concordaram. Confira a escala antes de decidir.'));
  }
 }
 const unique=[...new Map(notices.map(n=>[n.key,n])).values()].slice(0,120);
 const seen=new Set(db.prepare('SELECT key FROM intelligence_seen WHERE owner=?').all(session.userId).map(x=>x.key));
 return unique.map(n=>({...n,read:seen.has(n.key)}));
}
function mark(db,session,notices,key){
 if(!notices.some(n=>n.key===key))throw Error('Notificação não está disponível para este usuário.');
 db.prepare('INSERT OR REPLACE INTO intelligence_seen(owner,key,at) VALUES(?,?,?)').run(session.userId,key,new Date().toISOString());
 return true;
}
function markAll(db,session,notices){for(const n of notices)mark(db,session,notices,n.key);return true}
module.exports={list,mark,markAll};
