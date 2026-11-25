'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../desktop/demo-cloud.cjs');
test('contas de laboratório são distintas e ficam fora do workspace de produção',()=>{
 assert.equal(D.members.length,4);
 assert.equal(new Set(D.members.map(x=>x.user_id)).size,4);
 assert.deepEqual(D.members.map(x=>x.role),['admin','supervisor','operator','viewer']);
 assert.equal(D.workspace,'88888888-8888-4888-8888-888888888888');
});
test('autenticação de demonstração valida senha e perfil corretamente',async()=>{
 for(const member of D.members){
   const client=D.createClient();
   const bad=await client.auth.signInWithPassword({email:member.email,password:'incorreta'});
   assert.equal(bad.error.code,'invalid_credentials');
   const ok=await client.auth.signInWithPassword({email:member.email,password:D.demoPassword});
   assert.equal(ok.error,null);assert.equal(ok.data.user.id,member.user_id);
   const {data}=await client.from('mop_members').select('*').eq('user_id',member.user_id);
   assert.equal(data.length,1);assert.equal(data[0].role,member.role);
   assert.ok(!('email' in data[0]));
 }
});
test('usuários são resolvidos por nome; operações são locais e identificáveis',async()=>{
 const client=D.createClient();
 const {data}=await client.rpc('mop_resolve_login',{p_login:'admin.teste'});
 assert.equal(data,'admin.teste@mop-preview.test');
 const r=await client.rpc('mop_push',{p_op:'op1',p_id:'test-record',p_kind:'items',p_payload:{subject:'Demonstração'},p_base:0});
 assert.equal(r.data.record.version,1);
 const repeated=await client.rpc('mop_push',{p_op:'op1',p_id:'test-record',p_kind:'items',p_payload:{subject:'Demonstração'},p_base:0});
 assert.deepEqual(repeated.data,r.data);
});
