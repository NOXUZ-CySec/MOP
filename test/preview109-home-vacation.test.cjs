'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Store}=require('../desktop/store.cjs');
const {snapshot,applicable}=require('../desktop/home109.cjs');
const {generateSchedule}=(()=>({generateSchedule:null}))();
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Home 109 filters routines by calendar day and work period without mistaking a future task for today',()=>{
 const monday='2026-11-23',sunday='2026-11-22';
 assert.equal(applicable({recurrence:'daily',period:'Diurno'},monday,'Diurno'),true);
 assert.equal(applicable({recurrence:'daily',period:'Noturno'},monday,'Diurno'),false);
 assert.equal(applicable({recurrence:'weekdays',period:'Todos'},sunday,'Diurno'),false);
 assert.equal(applicable({recurrence:'weekly',weekday:1,period:'Todos'},monday,'Diurno'),true);
 assert.equal(applicable({recurrence:'weekly',weekday:1,period:'Todos'},sunday,'Diurno'),false);
 assert.equal(applicable({recurrence:'once',scheduled_date:monday,period:'Todos'},monday,'Diurno'),true);
 assert.equal(applicable({recurrence:'date',scheduled_date:'2026-11-24',period:'Todos'},monday,'Diurno'),false);
});
test('Home 109 loads real checklist completion data without modifying it',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mop109-'));const store=new Store(dir);
 try{
  const {setup}=require('../desktop/checklist68.cjs');setup(store.db);
  store.db.prepare("INSERT INTO checklist68 (id,title,period,enabled,created_by,created_at) VALUES (?,?,?,?,?,?)").run('todo','Inspecionar câmeras','Todos',1,'a',new Date().toISOString());
  const session={userId:'a',role:'operator',condos:null};
  const a=snapshot(store,session);assert.equal(a.tasks.length,1);assert.equal(a.tasks[0].done,false);
  store.db.prepare('INSERT INTO checklist100_team_runs(task_id,work_date,reminder_revision,completed_by,completed_at) VALUES(?,?,?,?,?)').run('todo',a.date,0,'a',new Date().toISOString());
  const b=snapshot(store,session);assert.equal(b.tasks[0].done,true);assert.equal(b.scope,'local');
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true})}
});
test('Home briefing links priorities and upcoming routines to the underlying items',()=>{
 const ui=read('ui-next/src/Home54.tsx');
 assert.match(ui,/Prioridades do plant\u00e3o/);
 assert.match(ui,/Pr\u00f3ximas rotinas/);
 assert.match(ui,/onOpenRecord\(r\.id\)/);
 assert.match(ui,/onOpenRoutine\(t\.id\)/);
 assert.match(ui,/onNavigate\('Checklists e Rotinas'\)/);
});
test('Vacations are selectable as a dedicated shift classification, including type and day display',()=>{
 const types=read('ui-next/src/SchedulePage.tsx');const ui=read('ui-next/src/Schedule70.tsx');
 assert.ok(types.includes("'vacation'"));assert.ok(ui.includes("{id:'vacation',name:'Férias'}"));assert.ok(ui.includes('vacation:Palmtree'));
 assert.ok(read('ui-next/src/schedule70.css').includes('.scale70-grid .scale-day.vacation'));
});
test('Vacation classification is persisted by both local and central shift stores',()=>{
 assert.ok(read('desktop/schedule68.cjs').includes("'vacation'"));
 assert.ok(read('desktop/schedule-central81.cjs').includes("'vacation'"));
});
test('Vacation appears in both PDF and Excel calendar exports, without counting as a worked day',async()=>{
 const exporter=require('../desktop/schedule-export76.cjs');
 const rows=[{date:'2026-11-02',kind:'vacation',reason:'Período de férias'}];
 const cal=exporter.calendar('2026-11',rows,'2026-11-01');
 assert.equal(cal.days.find(x=>x.date==='2026-11-02').label,'Férias');
 assert.equal(cal.days.find(x=>x.date==='2026-11-02').kind,'vacation');
 assert.ok(exporter.html({month:'2026-11',rows,employeeName:'Operador',anchorDate:'2026-11-01'}).includes('Férias'));
 const buffer=await exporter.xlsx({month:'2026-11',rows,employeeName:'Operador',anchorDate:'2026-11-01'});const ExcelJS=require('exceljs');const book=new ExcelJS.Workbook();await book.xlsx.load(buffer);
 assert.ok(book.worksheets[0].getCell('B7').value?.toString().includes('Férias'));
});
