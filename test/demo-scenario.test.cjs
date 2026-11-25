'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store,validate}=require('../desktop/store.cjs');
const S=require('../desktop/demo-scenario.cjs'),D=require('../desktop/demo-cloud.cjs');
function sandbox(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'mop-preview11-')),dir=path.join(root,S.allowedBase);fs.mkdirSync(dir);return {root,dir};}
test('cenário de gestores contém pendências, concluídos, históricos e 3 passagens',()=>{
 const s=S.createScenario();
 assert.equal(validate(s),s);
 assert.equal(s.items.length,14);
 assert.equal(s.handovers.length,3);
 assert.ok(s.events.length>=20);
 assert.ok(s.items.some(x=>x.priority==='Urgente'&&x.status!=='Resolvido'));
 assert.ok(s.items.some(x=>x.status==='Resolvido'&&x.resolved_at));
 assert.ok(s.items.some(x=>x.condo==='Condominio Restrito Demo'));
 assert.ok(s.items.every(x=>x.subject.includes('[DEMONSTRAÇÃO]')));
 assert.ok(s.handovers.every(x=>x.snapshot?.length&&x.receipt_at&&typeof x.open_ids==='string'));
});
test('dados são criados uma vez e preservam alterações voluntárias',()=>{
 const {root,dir}=sandbox();
 try{
   const store=new Store(path.join(dir,'dados'));
   assert.equal(S.initialize(store,dir),true);
   assert.equal(store.read().items.length,14);
   assert.equal(S.initialize(store,dir),false);
   const state=store.read();state.items[0].subject='Alteração voluntária do teste';store.write(state);
   assert.equal(S.initialize(store,dir),false);
   assert.equal(store.read().items[0].subject,'Alteração voluntária do teste');
   store.close();
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('restauração arquiva base anterior e cria nova sem perder dados',()=>{
 const {root,dir}=sandbox();
 try{
   let store=new Store(path.join(dir,'dados'));S.initialize(store,dir);
   const s=store.read();s.items[0].subject='Manter no arquivo anterior';store.write(s);store.close();
   assert.equal(S.requestReset(dir),true);
   assert.equal(S.prepareOnLaunch(dir),true);
   const archive=fs.readdirSync(path.join(dir,'restauracoes-anteriores'));
   assert.equal(archive.length,1);
   const old=new Store(path.join(dir,'restauracoes-anteriores',archive[0]));
   assert.equal(old.read().items[0].subject,'Manter no arquivo anterior');old.close();
   store=new Store(path.join(dir,'dados'));assert.equal(S.initialize(store,dir),true);
   assert.match(store.read().items[0].subject,/DEMONSTRAÇÃO/);store.close();
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('restaurar é impossível fora do diretório isolado de homologação',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mop-prod-'));
 try{assert.throws(()=>S.requestReset(root),/somente no perfil isolado/);assert.throws(()=>S.prepareOnLaunch(root),/somente no perfil isolado/);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
