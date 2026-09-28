const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {Store,empty} = require('../desktop/store.cjs');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop-test-'));const store=new Store(dir);t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});return {store,dir};}
test('gravação persiste após reabrir; backup preserva estado anterior',t=>{
  const {store,dir}=fixture(t);const state=empty();state.items.push({id:1,subject:'Câmera',status:'Pendente'});state.nextItem=2;
  store.write(state);assert.deepEqual(store.read(),state);
  const copy=JSON.parse(fs.readFileSync(path.join(store.backupDir,fs.readdirSync(store.backupDir)[0]),'utf8'));assert.deepEqual(copy,empty());
  const second=new Store(dir);assert.deepEqual(second.read(),state);second.close();
  const out=path.join(dir,'export.json');store.exportTo(out);assert.deepEqual(JSON.parse(fs.readFileSync(out)),state);
});
test('entrada inválida não altera banco',t=>{
  const {store}=fixture(t);const state=empty();state.events.push({id:1,item_id:999});state.nextEvent=2;
  assert.throws(()=>store.write(state),/correspondente/);assert.deepEqual(store.read(),empty());
});
test('falha de backup impede alteração; rotação mantém 30 cópias',t=>{
  const {store}=fixture(t);
  for(let i=0;i<34;i++){const s=empty();s.nextItem=i+2;store.write(s);}
  assert.equal(fs.readdirSync(store.backupDir).length,30);
  const before=store.read();store.backup=()=>{throw Error('disco cheio');};
  assert.throws(()=>store.write(empty()),/disco cheio/);assert.deepEqual(store.read(),before);
});
test('banco danificado nunca é apagado ou reinicializado',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop-corrupt-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const filename=path.join(dir,'mop.sqlite');fs.writeFileSync(filename,'arquivo danificado');assert.throws(()=>new Store(dir));assert.equal(fs.readFileSync(filename,'utf8'),'arquivo danificado');
});
