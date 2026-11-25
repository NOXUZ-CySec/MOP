'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),T=require('../src/tutorial.js');
const account=(role)=>({userId:'test',role});
test('guia de primeiro acesso foca no fluxo operacional do operador',()=>{
  const steps=T.stepsFor(account('operator'));
  assert.equal(steps.length,7);
  assert.deepEqual(steps.map(s=>s.title),[
    '1. Aceite da passagem de turno','Identificação do usuário','Menu Registros',
    'Menu Passagem de turno','Histórico e rastreabilidade','Ferramentas suplementares','Ajuda disponível quando precisar'
  ]);
  assert.ok(steps.some(s=>s.selector==='#shiftReceipt'));
  assert.ok(steps.some(s=>s.selector==='#sessionIdentity'));
  assert.ok(steps.some(s=>s.selector==='#handover .panel:nth-of-type(2) h2'));
  assert.ok(steps.some(s=>s.expandTools));
});
test('perfil de consulta não é orientado a assumir ou entregar turno',()=>{
  const steps=T.stepsFor(account('viewer'));
  assert.equal(steps.length,5);
  assert.ok(!steps.some(s=>s.tab==='handover'||s.selector==='#shiftReceipt'));
  assert.match(steps.find(s=>s.tab==='records').text,/leitura/);
});
test('todos os perfis apresentam acesso a registros, histórico e ferramentas',()=>{
  for(const role of ['viewer','operator','supervisor','admin']){
    const steps=T.stepsFor(account(role));
    assert.ok(steps.some(s=>s.title==='Menu Registros'));
    assert.ok(steps.some(s=>s.title==='Histórico e rastreabilidade'));
    assert.ok(steps.some(s=>s.title==='Ferramentas suplementares'));
    assert.ok(steps.some(s=>s.title==='Ajuda disponível quando precisar'));
    assert.ok(steps.length<=7);
  }
});
test('conclusão é separada por versão, conta e perfil',()=>{
  assert.match(T.keyFor(account('operator')),/2\.3\.0-preview\.10/);
  assert.notEqual(T.keyFor(account('operator')),T.keyFor(account('admin')));
  assert.notEqual(T.keyFor(account('operator')),T.keyFor({...account('operator'),userId:'other'}));
  assert.deepEqual(T.stepsFor(null),[]);
  assert.deepEqual(T.stepsFor(account('unknown')),[]);
});
