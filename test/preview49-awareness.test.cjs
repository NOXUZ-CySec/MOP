'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {Store}=require('../desktop/store.cjs');
test('Preview49 acknowledgement table is isolated, user and shift scoped, idempotent',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop-ack49-'));let store;
 try{store=new Store(dir);store.db.exec('CREATE TABLE shift_awareness49 (user_id TEXT NOT NULL,shift_id TEXT NOT NULL,version TEXT NOT NULL,ack_at TEXT NOT NULL,important_count INTEGER NOT NULL,PRIMARY KEY(user_id,shift_id,version))');
 const version=crypto.createHash('sha256').update('urgent-v1').digest('hex'),shift='2026-11-16/Diurno';
 const write=()=>store.db.prepare('INSERT OR IGNORE INTO shift_awareness49 VALUES (?,?,?,?,?)').run('operator-a',shift,version,new Date().toISOString(),2);
 write();write();
 const find=(user,day,v)=>store.db.prepare('SELECT ack_at FROM shift_awareness49 WHERE user_id=? AND shift_id=? AND version=?').get(user,day,v);
 assert.ok(find('operator-a',shift,version));assert.equal(find('operator-b',shift,version),undefined);
 assert.equal(find('operator-a','2026-11-17/Diurno',version),undefined);
 assert.equal(find('operator-a',shift,crypto.createHash('sha256').update('urgent-v2').digest('hex')),undefined);
 assert.equal(store.db.prepare('SELECT COUNT(*) n FROM shift_awareness49').get().n,1);
 assert.equal(store.db.prepare('PRAGMA quick_check').get().quick_check,'ok');
 }finally{store?.close();fs.rmSync(dir,{recursive:true,force:true})}
});
test('Legacy acknowledgment validates its version and operational writes check the effective shift receipt',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../desktop/main-next43.cjs'),'utf8');
 assert.ok(source.includes("ipcMain.handle('mop:awareness49'"));
 for(const [handler,operation] of [['record-create43','record creation'],['record-action96','record changes'],['handover36','handover']]){
  const marker="ipcMain.handle('mop:"+handler+"'";
  const start=source.indexOf(marker);
  assert.ok(start>=0,operation);
  const end=source.indexOf('ipcMain.handle(',start+marker.length);
  const block=source.slice(start,end<0?undefined:end);
  assert.match(block,/if\(!require\('\.\/startup-gate108\.cjs'\)\.snapshot\(store,session\)\.accepted\)throw/,operation);
 }
 assert.ok(source.includes('input?.version!==current.version'));
});
