'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('startup gate replaces standalone awareness modal and secondary handover redirect',()=>{
 const main=fs.readFileSync(path.join(root,'ui-next/src/main.tsx'),'utf8');
 assert.ok(main.includes('if(account?.role!==\'viewer\'&&!awarenessApproved)return <StartupReceipt108'));
 assert.ok(!main.includes('<ShiftAwareness49'));
 assert.ok(!main.includes('Revisar e assumir turno</button>'));
});
test('startup confirmation itself invokes effective receipt exactly once',()=>{
 const ui=fs.readFileSync(path.join(root,'ui-next/src/StartupReceipt108.tsx'),'utf8');
 assert.ok(ui.includes("startup108?.('receive'"));
 assert.ok(ui.includes('busy.current=true'));
 assert.ok(ui.includes("if(!response?.accepted)throw"));
 assert.ok(!ui.includes("setTab('Passagem de Turno')"));
});
test('write operations rely on effective receipt rather than prior informational acknowledgment',()=>{
 const main=fs.readFileSync(path.join(root,'desktop/main-next43.cjs'),'utf8');
 assert.ok(main.includes("ipcMain.handle('mop:startup108'"));
 assert.ok(main.includes("require('./startup-gate108.cjs').snapshot(store,session).accepted"));
 assert.ok(!main.includes('shiftAwareness49(session).accepted'));
});
