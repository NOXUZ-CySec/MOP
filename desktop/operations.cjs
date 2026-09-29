'use strict';
const {randomUUID}=require('node:crypto');
const domain=require('../src/operations.js');
const {stable}=require('./sync-store.cjs');
const privacy=require('../src/privacy.js');
const roles=['operator','supervisor','admin','viewer'];
function policy(member={}){return {role:roles.includes(member.role)?member.role:'operator',condos:Array.isArray(member.condos)?member.condos:null,display_name:privacy.label(member.display_name,member.user_id),access_version:member.access_version||1};}
function allows(session,condo){return session.condos===null||session.condos===undefined||session.condos.includes(condo);}
function visible(s,session){
  s=domain.normalize(structuredClone(s));s.items=s.items.filter(x=>allows(session,x.condo)&&(session.role==='admin'||!x.deleted_at));const ids=new Set(s.items.map(x=>x.id));
  s.events=s.events.filter(x=>ids.has(x.item_id));s.attachments=s.attachments.filter(x=>ids.has(x.item_id));
  s.handovers=s.handovers.filter(h=>session.condos==null||h.condo&&allows(session,h.condo)||(h.snapshot?.length&&h.snapshot.every(x=>allows(session,x.condo))));
  for(const kind of ['templates','runs','receipts'])s[kind]=s[kind].filter(x=>allows(session,x.condo));return privacy.clean(s);
}
function author(session){if(!session?.userId)throw Error('Conta autenticada obrigatória.');return {user_id:session.userId,display_name:privacy.label(session.display_name,session.userId)};}
function stampWrite(previous,input,session,now=new Date().toISOString()){
  if(session.role==='viewer')throw Error('Seu perfil permite somente consulta.');
  const who=author(session),next=domain.normalize(privacy.clean(input)),oldVisible=visible(previous,session);
  // IDs/counters belong to the full local store. Hidden rows must never be replaced.
  for(const [kind,counter] of Object.entries({items:'nextItem',events:'nextEvent',handovers:'nextHandover',...domain.collections})){
    const before=new Map(previous[kind].map(x=>[x.id,x]));
    for(const old of oldVisible[kind])if(!next[kind].some(x=>x.id===old.id))throw Error('Registros existentes não podem ser removidos.');
    for(const row of next[kind]){
      const old=before.get(row.id);
      if(old&&!oldVisible[kind].some(x=>x.id===row.id))throw Error('Registro fora do seu acesso.');
      if(old&&stable(privacy.clean(old))===stable(row)){Object.keys(row).forEach(k=>delete row[k]);Object.assign(row,old);continue;}
      if(old&&!['items','templates','handovers'].includes(kind))throw Error('Histórico, anexos e execuções são imutáveis.');if(old&&kind==='handovers'&&old.receipt_at)throw Error('Passagem de turno já recebida não pode ser alterada.');
      const parent=['events','attachments'].includes(kind)?next.items.find(x=>x.id===row.item_id):null;
      if(parent)row.condo=parent.condo;
      if(kind==='handovers'){
        if((row.snapshot||[]).some(x=>!allows(session,x.condo)))throw Error('Passagem fora do seu acesso.');
        const isReceipt=!!row.receipt_at||!!row.receipt_slot;
        if(isReceipt){const critical=next.items.filter(x=>allows(session,x.condo)&&x.status!=='Resolvido'&&(x.priority==='Urgente'||domain.alerts({...next,items:[x]}).some(a=>a.level==='late')));if(critical.some(x=>!row.critical_protocols?.includes(x.protocol)))throw Error('Confirme a leitura de cada pendência crítica.');row.incoming=who.display_name;row.incoming_identity=who;}
        else {row.outgoing=who.display_name;row.outgoing_identity=who;}
      }else if(!allows(session,row.condo))throw Error('Condomínio fora do seu acesso.');
      if(kind==='templates'&&!['admin','supervisor'].includes(session.role))throw Error('Somente supervisores podem configurar rotinas.');
      if(old&&['items','templates'].includes(kind)&&row.condo!==old.condo)throw Error('O condomínio do registro não pode ser alterado.');
      if(kind==='items'){
        if(!old&&row.deleted_at)throw Error('Um registro novo não pode ser criado como removido.');
        if(old?.deleted_at)throw Error('Registros removidos não podem ser alterados.');
        if(row.deleted_at){if(session.role!=='admin')throw Error('Somente administradores podem remover registros.');if(typeof row.deleted_reason!=='string'||!row.deleted_reason.trim()||row.deleted_reason.length>1000)throw Error('Informe o motivo da remoção.');row.deleted_by=who.display_name;row.deleted_identity=who;}else if(row.deleted_reason||row.deleted_by||row.deleted_identity)throw Error('Dados de remoção inválidos.');
        if(!old){row.created_by=who.display_name;row.created_identity=who;}
        else {row.created_by=privacy.clean(old).created_by;row.created_identity=privacy.clean(old.created_identity);}
        row.updated_by=who.display_name;row.updated_identity=who;row.updated_at=now;
        if(row.status==='Resolvido')row.resolved_at=old?.resolved_at||now;
      }else{row.author=who;if(kind==='events')row.actor=who.display_name;}
      if(!old)row.recorded_at=now;
      if(kind==='attachments')validateAttachment(row);
      if(kind==='templates')validateTemplate(row);
      if(kind==='runs'){
        const template=previous.templates.find(t=>t.key===row.template_key);
        if(!template||!allows(session,template.condo)||row.condo!==template.condo||!Array.isArray(row.answers)||row.answers.length!==template.steps.length||row.answers.some((a,i)=>a.label!==template.steps[i]||!['ok','fail','na'].includes(a.value)))throw Error('Checklist incompleto ou inválido.');
        if(row.slot!==domain.slot(template,new Date(now)))throw Error('Período do checklist desatualizado.');
        if(previous.runs.some(r=>r.template_key===row.template_key&&r.slot===row.slot))throw Error('Checklist já concluído neste período.');
      }
    }
    const submitted=new Set(next[kind].map(x=>x.id));next[kind].push(...previous[kind].filter(x=>!submitted.has(x.id)));
    next[counter]=Math.max(previous[counter],next[counter],...next[kind].map(x=>x.id+1));
  }
  return next;
}
function validateTemplate(t){if(!t.key||typeof t.title!=='string'||!t.title.trim()||!t.condo||!['once','shift','daily','weekly','monthly'].includes(t.frequency)||!/^\d{4}-\d{2}-\d{2}$/.test(t.start_date)||!Array.isArray(t.steps)||!t.steps.length||t.steps.length>50||t.steps.some(x=>typeof x!=='string'||!x.trim()||x.length>200))throw Error('Modelo de checklist inválido.');}
function validateAttachment(a){
  if(!['image/png','image/jpeg','application/pdf'].includes(a.mime)||typeof a.content!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(a.content))throw Error('Use anexos PNG, JPEG ou PDF.');
  const bytes=Buffer.from(a.content,'base64');if(!bytes.length||bytes.length>512*1024||bytes.toString('base64')!==a.content)throw Error('Cada anexo deve ter até 512 KB.');
  const valid=a.mime==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':a.mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(!valid)throw Error('O conteúdo não corresponde ao tipo do arquivo.');
  if(typeof a.name!=='string'||!a.name||a.name.length>180||/[\\/\x00-\x1f]/.test(a.name))throw Error('Nome de arquivo inválido.');
}
module.exports={policy,allows,visible,stampWrite,validateAttachment,validateTemplate,author};
