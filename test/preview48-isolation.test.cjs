'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../desktop/store.cjs');
const {stampWrite}=require('../desktop/operations.cjs');
test('Preview48: isolated database writes and handover-like snapshots do not lose records',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mop-preview48-isolated-'));let db;
 try{
  db=new Store(directory);const initial=db.read();
  const session={role:'admin',userId:'test-operator',display_name:'Teste Isolado',condos:null};
  const now=new Date().toISOString();
  const record={id:initial.nextItem,protocol:'MOP-TEST48-ISOLATED',condo:'TEST ONLY',company:'',category:'Sistemas',subject:'Teste isolado',description:'Sem dados reais',action_taken:'',next_action:'',source:'MOP test',reference:'',status:'Pendente',priority:'Normal',created_at:now,updated_at:now};
  const next=stampWrite(initial,{...initial,nextItem:initial.nextItem+1,items:[...initial.items,record]},session);
  db.write(next);assert.equal(db.read().items.length,1);
  const before=db.read();const row={id:before.nextHandover,at:now,delivered_at:now,note:'Teste isolado',open_ids:JSON.stringify([record.id]),snapshot:[structuredClone(record)],automation_version:1};
  const delivery={...before,nextHandover:before.nextHandover+1,handovers:[...before.handovers,row]};
  db.write(delivery);
  const received=db.read();received.handovers[0].receipt_at=new Date().toISOString();
  db.write(received);
  const final=db.read();assert.equal(final.items.length,1);assert.ok(final.handovers[0].receipt_at);
  db.close();db=null;db=new Store(directory);assert.equal(db.read().items[0].protocol,'MOP-TEST48-ISOLATED');
  assert.equal(db.db.prepare('PRAGMA quick_check').get().quick_check,'ok');
 }finally{db?.close();fs.rmSync(directory,{recursive:true,force:true})}
});
test('Preview48: production storage path is never used by isolated tests',()=>{
 const source=fs.readFileSync(path.join(__dirname,'preview48-isolation.test.cjs'),'utf8');
 assert.ok(source.includes('os.tmpdir()'));assert.ok(!source.includes('process.env.APP'+'DATA'));
});
