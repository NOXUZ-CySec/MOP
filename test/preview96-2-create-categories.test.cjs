'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('Creation categories exactly match the UI labels',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../desktop/main-next43.cjs'),'utf8');
 const ui=fs.readFileSync(path.join(__dirname,'../ui-next/src/NewRecordPage.tsx'),'utf8');
 assert.match(main,/\['Segurança','Sistemas','Rotina','Manutenção','Infraestrutura'\]/);
 assert.match(ui,/'Segurança','Sistemas','Rotina','Manutenção','Infraestrutura'/);
 assert.doesNotMatch(main,/\['SeguranÃ§a'/);
});
