'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fromChecklist,applicable}=require('../desktop/home109.cjs');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
test('Home converts Supabase checklist data into pending routines using the same central list date',()=>{
 const rows={date:'2026-11-23',scope:'central',tasks:[
  {id:'cloud-1',title:'Checklist Dispositivos',period:'Todos',recurrence:'daily',reminder_time:'07:30:00'},
  {id:'cloud-2',title:'Checklist Noturno',period:'Noturno',recurrence:'daily'},
  {id:'cloud-3',title:'Checklist Data Futura',period:'Todos',recurrence:'date',scheduled_date:'2026-11-24'}
 ],runs:[]};
 const view=fromChecklist(rows,new Date('2026-11-23T10:00:00Z'));
 assert.equal(view.scope,'central');assert.equal(view.tasks.length,1);assert.equal(view.tasks[0].title,'Checklist Dispositivos');assert.equal(view.tasks[0].done,false);
});
test('Completed routines are distinct from pending routines in central run data',()=>{
 const rows={date:'2026-11-23',scope:'central',tasks:[{id:'r1',title:'Feita',period:'Todos'},{id:'r2',title:'Pendente',period:'Todos'}],runs:[{task_id:'r1'}]};
 const result=fromChecklist(rows,new Date('2026-11-23T10:00:00Z'));
 assert.equal(result.tasks.length,2);assert.equal(result.tasks.find(t=>t.id==='r1').done,true);assert.equal(result.tasks.find(t=>t.id==='r2').done,false);
});
test('Desktop home IPC fetches same shared checklist source as Checklists e Rotinas',()=>{
 const backend=read('desktop/main-next43.cjs');
 const handler=backend.match(/ipcMain\.handle\('mop:home109',[\s\S]*?ipcMain\.handle\('mop:read48'/)?.[0]||'';
 assert.ok(handler.includes("shared.checklist(sync,session,'list')"));
 assert.ok(handler.includes("shared.active(sync,session)"));
 assert.ok(handler.includes("Rotinas centrais indisponíveis"));
 assert.ok(handler.includes("fromChecklist(rows)"));
});
test('Home refreshing pending routines on focus, sync updates and periodic timer',()=>{
 const ui=read('ui-next/src/Home54.tsx');
 assert.ok(ui.includes("window.mopDesktop!.home109!()"));
 assert.ok(ui.includes("onSync?.("));
 assert.ok(ui.includes("window.setInterval("));
 assert.ok(ui.includes("window.addEventListener('focus',focus)"));
 assert.ok(ui.includes("filter(t=>!t.done)"));
});
test('Global Escape returns any authorized page to Início without dismissing mandatory modals',()=>{
 const ui=read('ui-next/src/main.tsx');
 assert.ok(ui.includes("event.key!=='Escape'"));
 assert.ok(ui.includes("setTab('Início');setUserMenu(false)"));
 assert.ok(ui.includes("if(!auth||!awarenessApproved)return"));
 assert.ok(ui.includes("[role=\"alertdialog\"][aria-modal=\"true\"]"));
 assert.ok(ui.includes("closePrompt||recoveryOpen"));
});
test('Weekly and date-specific routine rules remain consistent with Checklists',()=>{
 assert.equal(applicable({recurrence:'weekly',weekday:1,period:'Todos'},'2026-11-23','Diurno'),true);
 assert.equal(applicable({recurrence:'date',scheduled_date:'2026-11-24',period:'Todos'},'2026-11-23','Diurno'),false);
});
