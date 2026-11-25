'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
test('Supervisors and admins see separated management navigation for three tools',()=>{const main=read('ui-next/src/main.tsx');assert.ok(main.includes("new Set(['Relatórios','Auditoria','Gerenciar Usuários'])"));assert.ok(main.includes("account?.role==='admin'||account?.role==='supervisor'"));assert.ok(main.includes('mop108-nav-separator'));assert.ok(main.includes('managementTabs.has(name)'))});
test('Operational divider appears before Início for all authorized profiles',()=>{const main=read('ui-next/src/main.tsx');assert.ok(main.includes('mop108-nav-operational'));assert.ok(main.includes('<span>OPERACIONAL</span>'));assert.ok(main.indexOf('<span>OPERACIONAL</span>')<main.indexOf("{nav.filter(([name])=>!managementTabs.has(name)"))});
test('Operator does not get manager tools through the sidebar',()=>{const main=read('ui-next/src/main.tsx');assert.ok(main.includes('!managementTabs.has(name)'));assert.ok(main.includes('roleCan(account?.role,tabPermission(name))'))});
