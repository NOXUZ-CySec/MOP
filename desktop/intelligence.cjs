'use strict';
const {createHash}=require('node:crypto');
const I=require('../src/intelligence.js'),privacy=require('../src/privacy.js'),{visible}=require('./operations.cjs');
const hash=s=>createHash('sha256').update(s).digest('hex');
const management=s=>{if(!s||!['supervisor','admin'].includes(s.role))throw Error('Acesso exclusivo de supervisor/admin.');};
const fullAdmin=s=>{if(s?.role!=='admin'||s.condos!=null)throw Error('Configuração geral exige administrador com acesso integral.');};
class Intelligence {
  constructor(store){
    this.store=store;this.db=store.db;
    this.db.exec(`CREATE TABLE IF NOT EXISTS intelligence_settings(key TEXT PRIMARY KEY,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS intelligence_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,payload TEXT NOT NULL,previous TEXT NOT NULL,digest TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON intelligence_audit BEGIN SELECT RAISE(ABORT,'Auditoria imutável'); END;
      CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON intelligence_audit BEGIN SELECT RAISE(ABORT,'Auditoria imutável'); END;
      CREATE TABLE IF NOT EXISTS intelligence_sla(record TEXT PRIMARY KEY,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS intelligence_favorites(owner TEXT NOT NULL,name TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(owner,name));
      CREATE TABLE IF NOT EXISTS intelligence_seen(owner TEXT NOT NULL,key TEXT NOT NULL,at TEXT NOT NULL,PRIMARY KEY(owner,key));
      CREATE TABLE IF NOT EXISTS intelligence_history(owner TEXT NOT NULL,key TEXT NOT NULL,at TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(owner,key));`);
  }
  policy(){return JSON.parse(this.db.prepare("SELECT payload FROM intelligence_settings WHERE key='sla'").get()?.payload||JSON.stringify(I.defaults()));}
  append(action,session,detail={},scopes=session?.condos??null,at=new Date().toISOString()){
    const payload=JSON.stringify(privacy.clean({at,action,actor:session?{id:session.userId,name:privacy.label(session.display_name,session.userId),role:session.role}:null,scopes,detail}));
    const previous=this.db.prepare('SELECT digest FROM intelligence_audit ORDER BY id DESC LIMIT 1').get()?.digest||'';
    this.db.prepare('INSERT INTO intelligence_audit(payload,previous,digest) VALUES(?,?,?)').run(payload,previous,hash(previous+payload));
  }
  transaction(fn){this.db.exec('SAVEPOINT intelligence');try{const result=fn();this.db.exec('RELEASE intelligence');return result;}catch(e){this.db.exec('ROLLBACK TO intelligence; RELEASE intelligence');throw e;}}
  audit(session,filters={}){
    management(session);let previous='';const rows=[];
    for(const row of this.db.prepare('SELECT * FROM intelligence_audit ORDER BY id').iterate()){
      if(row.previous!==previous||row.digest!==hash(previous+row.payload))throw Error('Falha na integridade da auditoria local.');previous=row.digest;
      const entry=JSON.parse(row.payload),scopes=entry.scopes;
      if(session.condos!=null&&(!scopes?.length||!scopes.every(c=>session.condos.includes(c))))continue;
      if(filters.action&&entry.action!==filters.action||filters.from&&entry.at.slice(0,10)<filters.from||filters.to&&entry.at.slice(0,10)>filters.to||filters.q&&!JSON.stringify(entry).toLocaleLowerCase().includes(String(filters.q).toLocaleLowerCase()))continue;
      rows.push({id:row.id,...entry});
    }
    const offset=Math.max(0,Number(filters.offset)||0);return {total:rows.length,rows:rows.reverse().slice(offset,offset+100),integrity:'verified'};
  }
  configure(session,input){fullAdmin(session);this.ensureSla(this.store.read().items);const before=this.policy(),next=I.validatePolicy(input);next.version=before.version+1;return this.transaction(()=>{this.db.prepare("INSERT INTO intelligence_settings VALUES('sla',?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload").run(JSON.stringify(next));this.append('settings.sla',session,{before,after:next});return next;});}
  ensureSla(items){const policy=this.policy();for(const x of items){if(x.deleted_at)continue;this.db.prepare('INSERT OR IGNORE INTO intelligence_sla VALUES(?,?)').run(x.protocol||String(x.id),JSON.stringify(I.baseline(x,policy)));}}
  slas(items,now=new Date()){this.ensureSla(items);return Object.fromEntries(items.filter(x=>!x.deleted_at).map(x=>{const base=JSON.parse(this.db.prepare('SELECT payload FROM intelligence_sla WHERE record=?').get(x.protocol||String(x.id)).payload);return [x.protocol||String(x.id),I.sla(x,base,now)];}));}
  override(session,input){management(session);const x=visible(this.store.read(),session).items.find(x=>x.id===input.id&&!x.deleted_at);if(!x||x.status==='Resolvido')throw Error('Registro indisponível para override.');if(typeof input.reason!=='string'||input.reason.trim().length<8||input.reason.length>1000||!Number.isFinite(I.stamp(input.due_at)))throw Error('Informe prazo válido e justificativa de ao menos 8 caracteres.');this.ensureSla([x]);return this.transaction(()=>{const key=x.protocol||String(x.id),before=JSON.parse(this.db.prepare('SELECT payload FROM intelligence_sla WHERE record=?').get(key).payload),after={...before,due_at:new Date(I.stamp(input.due_at)).toISOString(),override:true};if(I.stamp(after.due_at)<I.stamp(x.created_at))throw Error('O SLA não pode anteceder a criação.');this.db.prepare('UPDATE intelligence_sla SET payload=? WHERE record=?').run(JSON.stringify(after),key);this.append('sla.override',session,{record:key,reason:input.reason.trim(),before,after},[x.condo]);return after;});}
  favorites(session){return this.db.prepare('SELECT name,payload FROM intelligence_favorites WHERE owner=? ORDER BY name').all(session.userId).map(x=>({name:x.name,filters:JSON.parse(x.payload)}));}
  saveFavorite(session,input){const name=String(input.name||'').trim();if(!name||name.length>80)throw Error('Informe um nome de até 80 caracteres.');const filters={};for(const k of ['q','condo','status','priority','assignee','from','to','sla']){const v=input.filters?.[k];if(v!=null){if(typeof v!=='string'||v.length>300)throw Error('Filtro inválido.');filters[k]=v;}}for(const k of ['mine','urgent','overdue','unassigned'])filters[k]=input.filters?.[k]===true;
    if(session.condos!=null&&filters.condo&&!session.condos.includes(filters.condo))throw Error('Condomínio fora do seu acesso.');
    if(this.favorites(session).length>=30&&!this.favorites(session).some(x=>x.name===name))throw Error('Limite de 30 favoritos.');this.db.prepare('INSERT INTO intelligence_favorites VALUES(?,?,?) ON CONFLICT(owner,name) DO UPDATE SET payload=excluded.payload').run(session.userId,name,JSON.stringify(filters));return this.favorites(session);
  }
  removeFavorite(session,name){this.db.prepare('DELETE FROM intelligence_favorites WHERE owner=? AND name=?').run(session.userId,String(name));return this.favorites(session);}
  snapshot(session,now=new Date()){
    const state=visible(this.store.read(),session),slas=this.slas(state.items,now),seen=new Set(this.db.prepare('SELECT key FROM intelligence_seen WHERE owner=?').all(session.userId).map(x=>x.key));
    const notifications=I.notifications(state,session,this.policy(),slas,now).map(n=>({...n,read:seen.has(n.key)}));
    const active=new Set(notifications.map(n=>n.key));
    for(const n of notifications)this.db.prepare('INSERT INTO intelligence_history VALUES(?,?,?,?) ON CONFLICT(owner,key) DO UPDATE SET payload=excluded.payload').run(session.userId,n.key,now.toISOString(),JSON.stringify(n));
    this.db.prepare('DELETE FROM intelligence_history WHERE owner=? AND at<?').run(session.userId,new Date(+now-30*86400000).toISOString());
    const history=this.db.prepare('SELECT * FROM intelligence_history WHERE owner=? ORDER BY at DESC,key').all(session.userId).map(r=>({...JSON.parse(r.payload),at:r.at,read:seen.has(r.key),active:active.has(r.key)})).filter(n=>
      (n.condo==null||session.condos==null||session.condos.includes(n.condo))&&
      (!n.itemId||state.items.some(x=>x.id===n.itemId&&!x.deleted_at&&x.condo===n.condo))&&
      (n.type!=='shift'||session.role!=='viewer')).slice(0,200);
    return {policy:this.policy(),slas,favorites:this.favorites(session),notifications,history};
  }
  mark(session,key){if(!this.snapshot(session).history.some(n=>n.key===key))throw Error('Notificação fora do seu acesso ou desatualizada.');this.db.prepare('INSERT OR REPLACE INTO intelligence_seen VALUES(?,?,?)').run(session.userId,key,new Date().toISOString());return true;}
  markAll(session){const rows=this.snapshot(session).history;return this.transaction(()=>{for(const n of rows)this.db.prepare('INSERT OR REPLACE INTO intelligence_seen VALUES(?,?,?)').run(session.userId,n.key,new Date().toISOString());return true;});}
  changes(before,after,session){
    const fields=['status','priority','category','assignee','deadline','deleted_at','deleted_reason','subject','description','action_taken','next_action','edit_reason'];
    for(const x of after.items){const old=before.items.find(o=>o.id===x.id);if(!old){this.append('record.created',session,{record:x.protocol},[x.condo]);continue;}const changed=Object.fromEntries(fields.filter(k=>JSON.stringify(old[k])!==JSON.stringify(x[k])).map(k=>[k,{before:old[k]??null,after:x[k]??null}]));if(Object.keys(changed).length)this.append(x.deleted_at&&!old.deleted_at?'record.deleted':'record.updated',session,{record:x.protocol,changed},[x.condo]);}
    for(const h of after.handovers){const old=before.handovers.find(x=>x.id===h.id);if(h.receipt_at&&!old?.receipt_at)this.append(h.receipt_override?'shift.override':'shift.received',session,{id:h.id,reason:h.receipt_note||''},[...new Set((h.snapshot||[]).map(x=>x.condo))]);}
    for(const t of after.templates){const old=before.templates.find(x=>x.id===t.id);if(JSON.stringify(old)!==JSON.stringify(t))this.append('settings.checklist',session,{id:t.id,title:t.title,active:t.active},[t.condo]);}
    for(const event of after.events)if(!before.events.some(e=>e.id===event.id)){const item=after.items.find(x=>x.id===event.item_id);if(item)this.append('record.event',session,{record:item.protocol,kind:event.kind},[item.condo]);}
    this.ensureSla(after.items);
  }
  backupPayload(){return {policy:this.policy(),sla:this.db.prepare('SELECT record,payload FROM intelligence_sla').all(),audit:this.db.prepare('SELECT * FROM intelligence_audit ORDER BY id').all()};}
}
module.exports={Intelligence,management,fullAdmin};
