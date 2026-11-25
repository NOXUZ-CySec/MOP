'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../src/session-identity.js');
test('identidade distingue sessão e recebimento real por usuário',()=>{
 const account={userId:'a',display_name:'Ana',username:'ana',role:'operator'};
 assert.equal(S.describe(null,null),null);
 assert.equal(S.describe(account,null).shift,'Turno não assumido');
 assert.equal(S.describe(account,{receipt_user_id:'b',incoming:'Bia'}).assumed,false);
 const d=S.describe(account,{receipt_user_id:'a',incoming:'Ana'});
 assert.equal(d.shift,'Turno atual');assert.equal(d.username,'@ana');assert.equal(d.role,'Operador');
 assert.equal(S.describe({...account,role:'admin'},null).role,'Administrador');
});
