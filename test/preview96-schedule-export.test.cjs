'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const e=require('../desktop/schedule-export76.cjs');
test('Monthly 12x36 calendar reflects full cycle and approved exchanges',()=>{
 const data=e.calendar('2026-12',[{date:'2026-12-11',kind:'swap',reason:'Troca aprovada'}],'2026-12-01');
 assert.equal(data.days.length,31);
 assert.equal(data.days[0].label,'Plantão');
 assert.equal(data.days[1].label,'Folga');
 assert.equal(data.days[10].label,'Plantão (troca)');
 assert.equal(data.cells[0],null);
 assert.equal(data.plantao+data.folga,31);assert.equal(data.hours,data.plantao*11);
});
test('11-hour shifts exclude absence and medical leave, and count extra days',()=>{const c=e.calendar('2026-12',[{date:'2026-12-01',kind:'absence'},{date:'2026-12-03',kind:'medical'},{date:'2026-12-02',kind:'extra'}],'2026-12-01');assert.equal(c.absences,1);assert.equal(c.medicalDays,1);assert.equal(c.extraDays,1);assert.equal(c.hours,c.plantao*11);assert.equal(c.days[0].label,'Falta');assert.equal(c.days[2].label,'Atestado');});
test('Old holiday-off entries display as regular rest without changing historical data',()=>{const c=e.calendar('2026-12',[{date:'2026-12-02',kind:'holiday-off'}],'2026-12-01');assert.equal(c.days[1].label,'Folga');assert.equal(c.days[1].kind,'off');});
test('Excel export creates a valid xlsx workbook with calendar layout',async()=>{
 const b=await e.xlsx({month:'2026-12',rows:[],employeeName:'Teste',anchorDate:'2026-12-01'});
 assert.ok(b.length>5000);assert.equal(b.subarray(0,2).toString(),'PK');
});
test('PDF source contains a seven-column calendar and safe employee label',()=>{
 const text=e.html({month:'2026-12',rows:[],employeeName:'<Teste>',anchorDate:'2026-12-01'});
 assert.match(text,/grid-template-columns:repeat\(7/);assert.match(text,/&lt;Teste&gt;/);assert.match(text,/Folga/);
});
