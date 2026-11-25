'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.join(__dirname,'../src');
const gate=fs.readFileSync(path.join(base,'shift-gate.js'),'utf8');
const ui=fs.readFileSync(path.join(base,'handover-automation-ui.js'),'utf8');
test('aceite obrigatório envia protocolo e versão dos registros críticos',()=>{
 assert.match(gate,/data-read-protocol/);
 assert.match(gate,/data-read-version/);
 assert.match(gate,/MOPHandover\.version\(x\)/);
 assert.match(gate,/read_versions=Object\.fromEntries/);
});
test('última passagem pendente não é exibida como recebida',()=>{
 assert.match(gate,/aguardando seu recebimento/);
 assert.match(gate,/last\.delivered_at\|\|last\.at/);
});
test('histórico de passagem informa recebimento, ressalvas e auditoria',()=>{
 assert.match(ui,/Auditoria do recebimento/);
 assert.match(ui,/Ciências registradas/);
 assert.match(ui,/receipt_override/);
 assert.match(ui,/E\(h\.receipt_note\)/);
});
