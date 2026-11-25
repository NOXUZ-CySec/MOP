'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../ui-next/src');
const component=fs.readFileSync(path.join(root,'SwapCalendar109.tsx'),'utf8');
const schedule=fs.readFileSync(path.join(root,'Schedule70.tsx'),'utf8');
const stylesheet=fs.readFileSync(path.join(root,'swap-calendar109.css'),'utf8');
test('Swap request uses MOP calendar instead of native date picker',()=>{
 assert.ok(schedule.includes('<SwapCalendar109 value={peerDate}'));
 assert.ok(!schedule.includes('type="date" value={peerDate}'));
 assert.ok(schedule.includes('excludeDate={swapDate}'));
});
test('Swap calendar shares main calendar grid and day tile classes',()=>{
 assert.ok(component.includes('scale-calendar-grid scale70-grid scale109-swap-grid'));
 assert.ok(component.includes('className="scale-weekday"'));
 assert.ok(component.includes("className={'scale-day'"));
 assert.ok(stylesheet.includes('var(--mop-glass-panel'));
});
test('Swap calendar excludes the original shift date and all dates before today',()=>{
 assert.ok(component.includes('d<minDate||d===excludeDate'));
 assert.ok(component.includes('disabled={blocked}'));
 assert.ok(component.includes('aria-pressed={chosen}'));
});
test('Previous and next month navigation and selected value are retained',()=>{
 assert.ok(component.includes('onClick={()=>navigate(-1)}'));
 assert.ok(component.includes('onClick={()=>navigate(1)}'));
 assert.ok(component.includes('onClick={()=>onChange(d)}'));
});
test('Modal remains open until confirmation/cancel and Esc dismisses modal, not current screen',()=>{
 assert.ok(schedule.includes('aria-label="Solicitação de troca"'));
 assert.ok(schedule.includes('e.stopPropagation();setSwapOpen(false)'));
 const main=fs.readFileSync(path.join(root,'main.tsx'),'utf8');
 assert.ok(main.includes('[role="dialog"][aria-modal="true"]'));
});
