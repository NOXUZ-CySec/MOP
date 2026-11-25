'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../ui-next/src');
const theme=fs.readFileSync(path.join(root,'mop-theme1092.css'),'utf8');
const main=fs.readFileSync(path.join(root,'main.tsx'),'utf8');
test('109.2 patch loads after canonical theme',()=>{assert.ok(main.indexOf("import './mop-theme1092.css'")>main.indexOf("import './mop-theme1081.css'"))});
test('Checklist form is elevated above routine list as a stacking context',()=>{for(const token of ['.check68 .check98-form','.check68 .check68-list','z-index:8!important','z-index:0','.record-filter-menu'])assert.ok(theme.includes(token),token)});
test('Records actual list, metrics and details use canonical glass tokens',()=>{for(const token of ['.records-list','.records-detail','.records-metric','.records-search','.records-select','.records-description p','var(--mop-glass-panel)','var(--mop-glass-card)','var(--mop-glass-field)'])assert.ok(theme.includes(token),token)});
test('Selected records and active category colors are not overwritten',()=>{assert.ok(theme.includes('.records-row:not(.selected)'));assert.ok(theme.includes('.records-pages button:not(.current)'));assert.ok(!theme.includes('.records-status.Concluído'))});
