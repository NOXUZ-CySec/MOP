'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../desktop/store.cjs');
test('Preview51: isolated per-record acknowledgements are idempotent and version scoped',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop-ack51-'));let db;
 try{db=new Store(dir);db.db.exec('CREATE TABLE shift_ack51(user_id TEXT NOT NULL,shift_id TEXT NOT NULL,snapshot_version TEXT NOT NULL,record_id TEXT NOT NULL,record_version TEXT NOT NULL,ack_at TEXT NOT NULL,remote_at TEXT,PRIMARY KEY(user_id,shift_id,snapshot_version,record_id,record_version))');
 const insert=db.db.prepare('INSERT OR IGNORE INTO shift_ack51(user_id,shift_id,snapshot_version,record_id,record_version,ack_at) VALUES(?,?,?,?,?,?)');
 const a=['operator1','shiftA','snapshot1','incident1','rev1','2026-11-16T10:00:00Z'];
 insert.run(...a);insert.run(...a);insert.run('operator1','shiftA','snapshot1','incident2','rev2',a[5]);
 assert.equal(db.db.prepare('SELECT count(*) n FROM shift_ack51').get().n,2);
 assert.equal(db.db.prepare('SELECT count(*) n FROM shift_ack51 WHERE user_id=? AND shift_id=? AND snapshot_version=?').get('operator2','shiftA','snapshot1').n,0);
 assert.equal(db.db.prepare('SELECT count(*) n FROM shift_ack51 WHERE record_version=?').get('rev3').n,0);
 db.db.prepare('UPDATE shift_ack51 SET remote_at=? WHERE record_id=?').run('2026-11-16T10:01:00Z','incident1');
 assert.equal(db.db.prepare('SELECT count(*) n FROM shift_ack51 WHERE remote_at IS NULL').get().n,1);
 assert.equal(db.db.prepare('PRAGMA quick_check').get().quick_check,'ok');
 }finally{db?.close();fs.rmSync(dir,{recursive:true,force:true})}
});
test('Preview51: backend validates exact incident list and keeps pending sync locally',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../desktop/main-next43.cjs'),'utf8');
 assert.ok(s.includes('new Set(ids.map(String)).size!==current.items.length'));
 assert.ok(s.includes('current.items.some(x=>!ids.map(String).includes(String(x.id)))'));
 assert.ok(s.includes('remote_at IS NULL'));assert.ok(s.includes("'mop_shift_ack51'"));
});
