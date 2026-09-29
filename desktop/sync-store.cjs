'use strict';
const {createHash,randomUUID}=require('node:crypto');
const kinds=['items','events','handovers','templates','runs','receipts','attachments'];
const counters={items:'nextItem',events:'nextEvent',handovers:'nextHandover',...require('../src/operations.js').collections};
function stable(value){
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
function identity(kind,payload){
  // Matching legacy backups map to the same global identities across machines.
  const key=kind==='items'&&payload.protocol?payload.protocol:kind==='templates'?payload.key:kind==='runs'?payload.template_key+':'+payload.slot:stable(payload);
  const h=createHash('sha256').update('mop-v1:'+kind+':'+key).digest('hex');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);
}
class SyncStore {
  constructor(store){
    this.store=store;this.db=store.db;
    this.db.exec(`CREATE TABLE IF NOT EXISTS sync_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sync_map(kind TEXT NOT NULL,local_id INTEGER NOT NULL,remote_id TEXT NOT NULL UNIQUE,version INTEGER NOT NULL DEFAULT 0,payload TEXT NOT NULL,PRIMARY KEY(kind,local_id));
      CREATE TABLE IF NOT EXISTS sync_pending(remote_id TEXT PRIMARY KEY,op_id TEXT NOT NULL,payload TEXT NOT NULL,flight TEXT);
      CREATE TABLE IF NOT EXISTS sync_conflicts(remote_id TEXT PRIMARY KEY,remote TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sync_resolutions(id TEXT PRIMARY KEY,at TEXT NOT NULL,remote_id TEXT NOT NULL,choice TEXT NOT NULL,local TEXT NOT NULL,remote TEXT NOT NULL);`);
    store.onWrite=state=>{if(this.bound())this.queue(state);};
  }
  setting(key){return this.db.prepare('SELECT value FROM sync_settings WHERE key=?').get(key)?.value;}
  set(key,value){this.db.prepare('INSERT INTO sync_settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,String(value));}
  bound(){return this.setting('binding');}
  prepareProtocols(){
    const state=this.store.read(),used=new Set();let changed=false;
    for(const row of state.items)if(row.protocol){
      if(typeof row.protocol!=='string'||!/^MOP-\d{8}-[A-Z0-9]{6,32}$/.test(row.protocol)||used.has(row.protocol))throw Error('Protocolo local inválido ou repetido. Confira os dados antes de sincronizar.');
      used.add(row.protocol);
    }
    for(const row of state.items)if(!row.protocol){
      const date=new Date(row.created_at||Date.now());
      if(Number.isNaN(date.getTime()))throw Error('Data local inválida. Confira os dados antes de sincronizar.');
      const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(p=>[p.type,p.value]));
      do{row.protocol='MOP-'+parts.year+parts.month+parts.day+'-'+randomUUID().replaceAll('-','').slice(0,12).toUpperCase();}while(used.has(row.protocol));
      used.add(row.protocol);changed=true;
    }
    if(changed)this.store.write(state);
  }
  transaction(fn,backup=false){
    if(backup)this.store.backup();
    this.db.exec('BEGIN IMMEDIATE');
    try{const value=fn();this.db.exec('COMMIT');return value;}catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  bind(binding,config){
    if(this.bound()&&this.bound()!==binding)throw Error('Este banco local já pertence a outra central. Use um perfil separado para trocar de central.');
    if(this.bound()){if(config)this.set('config',JSON.stringify(config));return;}
    this.transaction(()=>{this.set('binding',binding);if(config)this.set('config',JSON.stringify(config));this.set('cursor',0);this.queue(this.store.read());},true);
  }
  map(kind,id){return this.db.prepare('SELECT * FROM sync_map WHERE kind=? AND local_id=?').get(kind,id);}
  byRemote(id){return this.db.prepare('SELECT * FROM sync_map WHERE remote_id=?').get(id);}
  wire(kind,row){
    const p=JSON.parse(JSON.stringify(row));delete p.id;
    const reference=id=>{const m=this.map('items',id);if(!m)throw Error('Referência de registro não encontrada: '+id);return m.remote_id;};
    if(kind==='events'||kind==='attachments')p.item_id=reference(p.item_id);
    if(kind==='handovers'){
      p.open_ids=JSON.parse(p.open_ids).map(reference);
      if(p.snapshot)p.snapshot=p.snapshot.map(x=>({...x,id:reference(x.id)}));
    }
    return p;
  }
  queue(state){
    for(const kind of kinds){
      const ids=new Set(state[kind].map(r=>r.id));
      for(const m of this.db.prepare('SELECT local_id FROM sync_map WHERE kind=?').all(kind))if(!ids.has(m.local_id))throw Error('Uma base sincronizada não pode ser substituída ou ter registros removidos por importação. Exporte um backup e mescle os registros.');
      for(const row of state[kind]){
        const payload=stable(this.wire(kind,row));let m=this.map(kind,row.id);
        if(!m){
          const remote=identity(kind,JSON.parse(payload));
          if(this.byRemote(remote))throw Error('Dois registros locais possuem a mesma identidade. Confira os protocolos antes de sincronizar.');
          this.db.prepare('INSERT INTO sync_map(kind,local_id,remote_id,payload) VALUES(?,?,?,?)').run(kind,row.id,remote,payload);
          m=this.map(kind,row.id);
          this.db.prepare('INSERT INTO sync_pending(remote_id,op_id,payload) VALUES(?,?,?)').run(remote,randomUUID(),payload);
        }else if(m.payload!==payload){
          if(!['items','templates','handovers'].includes(kind)&&m.version>0)throw Error('Históricos já sincronizados não podem ser alterados.');if(kind==='handovers'&&m.version>0){const previous=JSON.parse(m.payload);if(previous.receipt_at)throw Error('Passagem de turno já recebida não pode ser alterada.');if(!row.receipt_at)throw Error('Entrega de turno sincronizada só pode ser alterada para registrar o recebimento.');}
          this.db.prepare('UPDATE sync_map SET payload=? WHERE remote_id=?').run(payload,m.remote_id);
          this.db.prepare('INSERT INTO sync_pending(remote_id,op_id,payload) VALUES(?,?,?) ON CONFLICT(remote_id) DO UPDATE SET op_id=excluded.op_id,payload=excluded.payload').run(m.remote_id,randomUUID(),payload);
        }
      }
    }
  }
  status(){return {bound:!!this.bound(),pending:this.db.prepare('SELECT count(*) n FROM sync_pending').get().n,conflicts:this.db.prepare('SELECT count(*) n FROM sync_conflicts').get().n,lastSync:this.setting('lastSync')||null};}
  next(allowed=()=>true){
    const p=this.db.prepare(`SELECT p.*,m.kind,m.version,m.local_id FROM sync_pending p JOIN sync_map m USING(remote_id)
      WHERE NOT EXISTS(SELECT 1 FROM sync_conflicts c WHERE c.remote_id=p.remote_id)
      ORDER BY CASE m.kind WHEN 'items' THEN 0 WHEN 'events' THEN 1 ELSE 2 END,p.rowid`).all().find(allowed);
    if(!p)return null;
    if(p.flight)return JSON.parse(p.flight);
    const op={id:p.remote_id,kind:p.kind,op:p.op_id,base:p.version,payload:JSON.parse(p.payload)};
    this.db.prepare('UPDATE sync_pending SET flight=? WHERE remote_id=?').run(JSON.stringify(op),p.remote_id);
    return op;
  }
  acknowledge(op,result){
    const r=result.record;
    if(!r||r.id!==op.id||r.kind!==op.kind||!Number.isSafeInteger(r.version)||r.version<1||!Number.isSafeInteger(r.revision)||r.revision<1)throw Error('Resposta de sincronização inválida.');
    this.transaction(()=>{
      const p=this.db.prepare('SELECT * FROM sync_pending WHERE remote_id=?').get(op.id);
      if(!p)return;
      if(!result.ok){this.db.prepare('INSERT INTO sync_conflicts VALUES(?,?) ON CONFLICT(remote_id) DO UPDATE SET remote=excluded.remote').run(op.id,JSON.stringify(r));return;}
      this.db.prepare('UPDATE sync_map SET version=? WHERE remote_id=?').run(r.version,op.id);
      // An idempotent receipt may describe an older version than the latest
      // remote row skipped while this operation was pending. Revisit that range.
      this.set('cursor',Math.min(Number(this.setting('cursor')||0),r.revision-1));
      if(p.op_id===op.op)this.db.prepare('DELETE FROM sync_pending WHERE remote_id=?').run(op.id);
      else this.db.prepare('UPDATE sync_pending SET flight=NULL WHERE remote_id=?').run(op.id);
    });
  }
  materialize(state,m,p){
    const local=id=>{const ref=this.byRemote(id);if(!ref||ref.kind!=='items')throw Error('Referência remota ausente. A sincronização será repetida.');return ref.local_id;};
    const row={...JSON.parse(JSON.stringify(p)),id:m.local_id};
    if(m.kind==='events'||m.kind==='attachments')row.item_id=local(row.item_id);
    if(m.kind==='handovers'){
      row.open_ids=JSON.stringify(row.open_ids.map(local));
      if(row.snapshot)row.snapshot=row.snapshot.map(x=>({...x,id:local(x.id)}));
    }
    const i=state[m.kind].findIndex(x=>x.id===m.local_id);
    if(i<0)state[m.kind].push(row);else state[m.kind][i]=row;
  }
  saveState(state){
    require('./store.cjs').validate(state);
    const raw=JSON.stringify(state);
    if(Buffer.byteLength(raw)>64*1024*1024)throw Error('Base excede o limite local de 64 MB.');
    this.db.prepare('UPDATE state SET payload=?,updated_at=? WHERE id=1').run(raw,new Date().toISOString());
  }
  apply(rows,cursor){
    if(!rows.length)return false;
    let changed=false;
    this.transaction(()=>{
      const state=this.store.read();
      // Allocate all local IDs first so references work even across page boundaries.
      for(const r of rows){
        if(!kinds.includes(r.kind)||!r.payload||!Number.isSafeInteger(r.version)||r.version<1)throw Error('Dados remotos inválidos.');
        if(!this.byRemote(r.id))this.db.prepare('INSERT INTO sync_map(kind,local_id,remote_id,version,payload) VALUES(?,?,?,?,?)').run(r.kind,state[counters[r.kind]]++,r.id,0,'{}');
      }
      for(const kind of kinds)for(const r of rows.filter(x=>x.kind===kind)){
        const m=this.byRemote(r.id);
        if(m.kind!==r.kind)throw Error('Identidade remota incompatível.');
        const conflict=this.db.prepare('SELECT 1 FROM sync_conflicts WHERE remote_id=?').get(r.id);
        if(conflict)this.db.prepare('UPDATE sync_conflicts SET remote=? WHERE remote_id=?').run(JSON.stringify(r),r.id);
        if(this.db.prepare('SELECT 1 FROM sync_pending WHERE remote_id=?').get(r.id))continue;
        if(r.version<=m.version)continue;
        this.materialize(state,m,r.payload);changed=true;
        this.db.prepare('UPDATE sync_map SET version=?,payload=? WHERE remote_id=?').run(r.version,stable(r.payload),r.id);
      }
      if(changed)this.saveState(state);
      this.set('cursor',cursor);
    },true);
    return changed;
  }
  conflicts(){return this.db.prepare('SELECT c.*,m.kind,m.local_id,m.payload FROM sync_conflicts c JOIN sync_map m USING(remote_id)').all().map(r=>({id:r.remote_id,kind:r.kind,localId:r.local_id,local:JSON.parse(r.payload),remote:JSON.parse(r.remote)}));}
  resolve(id,choice,expectedVersion){
    if(!['local','remote'].includes(choice))throw Error('Escolha de conflito inválida.');
    this.transaction(()=>{
      const c=this.conflicts().find(c=>c.id===id);if(!c)throw Error('Conflito não encontrado.');
      if(c.remote.version!==expectedVersion)throw Error('O registro mudou novamente. Reabra a comparação antes de escolher.');
      if(choice==='local'&&!['items','templates'].includes(c.kind))throw Error('Históricos e passagens sincronizados são imutáveis.');
      this.db.prepare('INSERT INTO sync_resolutions VALUES(?,?,?,?,?,?)').run(randomUUID(),new Date().toISOString(),id,choice,JSON.stringify(c.local),JSON.stringify(c.remote));
      if(choice==='remote'){
        const state=this.store.read();this.materialize(state,this.byRemote(id),c.remote.payload);this.saveState(state);
        this.db.prepare('UPDATE sync_map SET payload=? WHERE remote_id=?').run(stable(c.remote.payload),id);
        this.db.prepare('DELETE FROM sync_pending WHERE remote_id=?').run(id);
      }else this.db.prepare('UPDATE sync_pending SET op_id=?,flight=NULL WHERE remote_id=?').run(randomUUID(),id);
      this.db.prepare('UPDATE sync_map SET version=? WHERE remote_id=?').run(c.remote.version,id);
      this.db.prepare('DELETE FROM sync_conflicts WHERE remote_id=?').run(id);
    },true);
  }
}
module.exports={SyncStore,stable,identity};
