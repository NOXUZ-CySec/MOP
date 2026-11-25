'use strict';
const {randomUUID}=require('node:crypto');
const {visible,stampWrite}=require('./operations.cjs');
const allowedCategories=new Set(['Segurança','Sistemas','Rotina','Manutenção','Infraestrutura']);
const allowedStatus=new Set(['Pendente','Em andamento','Resolvido']);
const clean=(v,max,required=true)=>{const x=String(v??'').trim();if(x.length>max||required&&!x)throw Error('Campo obrigatório ou acima do limite permitido.');return x;};
const identifier=(row)=>row.protocol||String(row.id);
function action(store,session,operation,input={}){
 if(!session?.userId||session.role==='viewer')throw Error('Acesso a registros não autorizado.');
 if(!['edit','duplicate','delete'].includes(operation))throw Error('Operação inválida.');
 const old=store.read();
 const found=visible(old,session).items.find(x=>identifier(x)===String(input.id)&&!x.deleted_at);
 if(!found)throw Error('Registro inexistente ou fora do seu acesso.');
 const privileged=['supervisor','admin'].includes(session.role);
 const isAuthor=found.created_identity?.user_id===session.userId;
 if(operation==='edit'&&!privileged&&!isAuthor)throw Error('O operador só pode editar registros de sua autoria identificada.');
 if(operation==='delete'&&session.role!=='admin')throw Error('Somente administradores podem excluir registros.');
 const base=old.items.find(x=>x.id===found.id);
 if(!base||base.deleted_at)throw Error('O registro foi alterado ou removido. Atualize a consulta.');
 const next=structuredClone(old);
 const idx=next.items.findIndex(x=>x.id===base.id);
 let updated;
 if(operation==='delete'){
  const reason=clean(input.reason,1000);
  if(reason.length<8)throw Error('A justificativa deve ter pelo menos 8 caracteres.');
  updated={...base,deleted_at:new Date().toISOString(),deleted_reason:reason};
  next.items[idx]=updated;
 }else{
  const condo=clean(input.condo,100);
  if(condo!==base.condo)throw Error('A unidade do registro original não pode ser modificada.');
  const subject=clean(input.subject,160),description=clean(input.description,3000),action_taken=clean(input.action_taken,3000,false),category=clean(input.category,80),status=clean(input.status,50);
  if(!allowedCategories.has(category)||!allowedStatus.has(status))throw Error('Categoria ou status não autorizado.');
  if(operation==='edit'){
   const statusOnly=subject===base.subject&&description===base.description&&action_taken===(base.action_taken||'')&&category===base.category&&status!==base.status;const editReason=statusOnly?'':clean(input.reason,1000);if(!statusOnly&&editReason.length<8)throw Error('Informe a justificativa da edição com pelo menos 8 caracteres.');updated={...base,subject,description,action_taken,category,status};if(!statusOnly)updated.edit_reason=editReason;
   next.items[idx]=updated;
  }else{
   const id=next.nextItem++;
   updated={...base,id,protocol:'MOP-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+randomUUID().replaceAll('-','').slice(0,12).toUpperCase(),subject,description,action_taken,category,status,created_at:new Date().toISOString(),source:'MOP UI Next · duplicação',reference:identifier(base),resolved_at:undefined};
   delete updated.created_by;delete updated.created_identity;delete updated.updated_by;delete updated.updated_identity;delete updated.deleted_at;delete updated.deleted_reason;delete updated.deleted_by;delete updated.deleted_identity;
   next.items.push(updated);
  }
 }
 const stamped=stampWrite(old,next,session);
 const previousAudit=store.intelligence;
 if(!previousAudit)store.intelligence=new (require('./intelligence.cjs').Intelligence)(store);
 try{store.write(stamped,session);}finally{if(!previousAudit)delete store.intelligence;}
 return {id:updated.id,protocol:updated.protocol,operation};
}
module.exports={action};
