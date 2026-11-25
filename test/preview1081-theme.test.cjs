'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../ui-next/src');
const stylesheet=fs.readFileSync(path.join(root,'mop-theme1081.css'),'utf8');
const main=fs.readFileSync(path.join(root,'main.tsx'),'utf8');
test('Shared theme is loaded after legacy CSS imports',()=>{
 assert.ok(main.includes("import './mop-theme1081.css';"));
 assert.ok(main.indexOf("import './mop-theme1081.css';")>main.indexOf("import './premium47.css';"));
});
test('Tokens match approved Início and Registros surfaces',()=>{
 for(const [key,value] of Object.entries({'--mop-blue-panel':'#09263b','--mop-blue-card':'#0b2e47','--mop-blue-field':'#071b2b','--mop-blue-stroke':'#285a74'}))
  assert.ok(stylesheet.includes(key+':'+value),key);
});
test('Unified themes cover operational and management modules',()=>{
 for(const selector of ['.occ102-list','.rep104-panel','.audit52-table','.check68-form','.scale70-toolbar','.management35-panel','.handover-panel','.new33-panel','.rep106-metric','.mop108-dialog','.mop-confirm46'])
  assert.ok(stylesheet.includes(selector),selector);
});
test('Semantic states in underlying modules remain represented',()=>{
 const occurrence=fs.readFileSync(path.join(root,'occurrences102.css'),'utf8');
 const scale=fs.readFileSync(path.join(root,'schedule70.css'),'utf8');
 assert.ok(occurrence.includes('.occ102-status.done'));
 assert.ok(occurrence.includes('.occ102-status.progress'));
 assert.ok(scale.includes('.scale-day.work'));
 assert.ok(!stylesheet.includes(' .scale-day,'));
});
test('Color scheme is defined once and scoped without affecting generic host UI',()=>{
 assert.ok(stylesheet.includes('.ref-app .mop-page47'));
 assert.ok(stylesheet.includes('var(--mop-glass-panel)'));
 assert.ok(stylesheet.includes('var(--mop-glass-field)'));
 assert.ok(stylesheet.includes('status colors'));
});
