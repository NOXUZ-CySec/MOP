'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const empty = () => require('../src/operations.js').normalize({items:[],events:[],handovers:[],nextItem:1,nextEvent:1,nextHandover:1});

function validate(state) {
  if (!state || typeof state !== 'object') throw Error('Dados inválidos.');
  require('../src/operations.js').normalize(state);
  for (const [name,counter] of [['items','nextItem'],['events','nextEvent'],['handovers','nextHandover'],...Object.entries(require('../src/operations.js').collections)]) {
    if (!Array.isArray(state[name])) throw Error('Coleção inválida: '+name);
    const ids = new Set(); let max = 0;
    for (const row of state[name]) {
      if (!row || !Number.isSafeInteger(row.id) || row.id < 1 || ids.has(row.id)) throw Error('Identificador inválido ou repetido: '+name);
      ids.add(row.id); max = Math.max(max,row.id);
    }
    if (!Number.isSafeInteger(state[counter]) || state[counter] <= max) throw Error('Contador inválido: '+counter);
  }
  const ids = new Set(state.items.map(x=>x.id));
  if (state.events.some(x=>!ids.has(x.item_id))) throw Error('Histórico sem registro correspondente.');
  if (state.attachments.some(x=>!ids.has(x.item_id))) throw Error('Anexo sem registro correspondente.');
  return state;
}

class Store {
  constructor(directory) {
    this.directory = directory;
    this.backupDir = path.join(directory,'backups');
    fs.mkdirSync(this.backupDir,{recursive:true});
    this.db = new DatabaseSync(path.join(directory,'mop.sqlite'));
    try {
      this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
      if (this.db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw Error('Banco danificado. Preserve os arquivos e restaure um backup.');
      this.db.exec('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, updated_at TEXT NOT NULL)');
      this.db.prepare('INSERT OR IGNORE INTO state VALUES (1,?,?)').run(JSON.stringify(empty()),new Date().toISOString());
      this.read(); // Nunca substituir automaticamente um banco inválido por dados vazios.
    } catch(error) { this.db.close(); throw error; }
  }
  read() { return validate(JSON.parse(this.db.prepare('SELECT payload FROM state WHERE id=1').get().payload)); }
  backup() {
    const filename = 'mop-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.json';
    const final = path.join(this.backupDir,filename);
    this.exportTo(final);
    // Retém as 30 cópias mais recentes. Exportações manuais ficam fora desta rotação.
    const files = fs.readdirSync(this.backupDir).filter(x=>/^mop-.*\.json$/.test(x)).sort().reverse();
    for (const old of files.slice(30)) { try { fs.unlinkSync(path.join(this.backupDir,old)); } catch {} }
    return final;
  }
  exportTo(destination) {
    const tmp = destination+'.'+randomUUID()+'.tmp';
    let fd;
    try {
      fd = fs.openSync(tmp,'wx',0o600);
      fs.writeFileSync(fd,JSON.stringify(require('../src/privacy.js').clean({...this.read(),...(this.intelligence?{_intelligence:this.intelligence.backupPayload()}: {})}),null,2),'utf8');
      fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
      fs.renameSync(tmp,destination);
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
  }
  write(input,session) {
    const before=this.intelligence?this.read():null;
    validate(input);
    const raw = JSON.stringify(input);
    if (Buffer.byteLength(raw) > 64*1024*1024) throw Error('Base excede o limite de 64 MB desta versão.');
    validate(JSON.parse(raw));
    if (raw === this.db.prepare('SELECT payload FROM state WHERE id=1').get().payload) return;
    // A cópia anterior precisa existir antes de qualquer alteração ou importação.
    this.backup();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('UPDATE state SET payload=?, updated_at=? WHERE id=1').run(raw,new Date().toISOString());
      if (this.db.prepare('SELECT payload FROM state WHERE id=1').get().payload !== raw) throw Error('Falha ao verificar a gravação.');
      if(this.intelligence)this.intelligence.changes(before,JSON.parse(raw),session);
      if(this.onWrite)this.onWrite(JSON.parse(raw));
      this.db.exec('COMMIT');
    } catch(error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close() { this.db.close(); }
}
module.exports = {Store,validate,empty};
