'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {rangeSelection}=require('../ui-next/src/schedule-drag109.cjs');
const days=Array.from({length:30},(_,i)=>'2026-11-'+String(i+1).padStart(2,'0'));
test('Dragging across a week boundary selects all intermediate days',()=>{
 assert.deepEqual(rangeSelection(days,'2026-11-05','2026-11-12'),days.slice(4,12));
});
test('Reverse direction while pointer stays down unselects dates beyond current pointer',()=>{
 const full=rangeSelection(days,'2026-11-05','2026-11-12');
 assert.equal(full.length,8);
 const reversed=rangeSelection(days,'2026-11-05','2026-11-08');
 assert.deepEqual(reversed,days.slice(4,8));
 assert.ok(!reversed.includes('2026-11-12'));
});
test('Returning pointer to anchor removes all added dates except anchor',()=>{
 assert.deepEqual(rangeSelection(days,'2026-11-05','2026-11-05'),['2026-11-05']);
});
test('Dragging backwards from date 16 to date 10 selects all days in interval',()=>{
 assert.deepEqual(rangeSelection(days,'2026-11-16','2026-11-10'),days.slice(9,16));
});
test('Crossing anchor selects the opposite direction and removes the original side',()=>{
 const forward=rangeSelection(days,'2026-11-10','2026-11-16');
 const backward=rangeSelection(days,'2026-11-10','2026-11-07');
 assert.equal(forward.length,7);assert.deepEqual(backward,days.slice(6,10));assert.ok(!backward.includes('2026-11-16'));
});
test('Ctrl preserved selection is not altered by pointer reversing',()=>{
 const baseline=['2026-11-02','2026-11-20'];
 const after=rangeSelection(days,'2026-11-10','2026-11-12',baseline);
 const reversed=rangeSelection(days,'2026-11-10','2026-11-11',baseline);
 assert.deepEqual(after,['2026-11-02','2026-11-20','2026-11-10','2026-11-11','2026-11-12']);
 assert.deepEqual(reversed,['2026-11-02','2026-11-20','2026-11-10','2026-11-11']);
});
test('Invalid hover target does not add unexpected date',()=>{
 assert.deepEqual(rangeSelection(days,'2026-11-10','2026-12-01',['2026-11-02']),['2026-11-02']);
});
test('Calendar wires pointer tracking into continuous selection helper',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../ui-next/src/Schedule70.tsx'),'utf8');
 assert.ok(ui.includes('rangeSelection(dates,drag.start,date,drag.baseline)'));
 assert.ok(ui.includes('onPointerMove='));
 assert.ok(ui.includes('setPointerCapture(e.pointerId)'));
 assert.ok(!ui.includes('visited.add(date)'));
});
