"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const load=()=>import(pathToFileURL(path.join(__dirname,"../ui-next/src/components/analytics1097/analytics-data.ts")).href);
test("occurrences use Sao Paulo calendar days and exclude future timestamps",async()=>{
 const {buildOccurrenceSeries1097}=await load();
 const records=[
  {category:"Segurança",occurredAt:"2026-11-25T02:59:59Z"},
  {category:"Segurança",occurredAt:"2026-11-25T03:00:00Z"},
  {category:"Manutenção",occurredAt:"2026-11-25T16:00:00Z"},
 ];
 const result=buildOccurrenceSeries1097(records,7,new Date("2026-11-25T15:00:00Z"));
 assert.equal(result.length,7);
 assert.equal(result.at(-2).key,"2026-11-24");
 assert.equal(result.at(-2).count,1);
 assert.equal(result.at(-1).key,"2026-11-25");
 assert.equal(result.at(-1).count,1);
});
test("occurrence series excludes routines, invalid dates and records outside the window",async()=>{
 const {buildOccurrenceSeries1097}=await load();
 const rows=[
  {category:"Rotina",occurredAt:"2026-11-25T10:00:00Z"},
  {category:" rotina ",occurredAt:"2026-11-25T10:00:00Z"},
  {category:"Segurança",occurredAt:"not-a-date"},
  {category:"Segurança",occurredAt:"2026-10-01T10:00:00Z"},
  {category:"Manutenção",occurredAt:"2026-11-20T10:00:00Z"},
 ];
 const frozen=JSON.stringify(rows);
 const result=buildOccurrenceSeries1097(rows,7,new Date("2026-11-25T15:00:00Z"));
 assert.equal(result.reduce((sum,p)=>sum+p.count,0),1);
 assert.equal(JSON.stringify(rows),frozen);
});
test("switching period includes older authorized records without inventing data",async()=>{
 const {buildOccurrenceSeries1097}=await load();
 const rows=[{category:"Segurança",occurredAt:"2026-11-01T10:00:00Z"}];
 const now=new Date("2026-11-25T15:00:00Z");
 assert.equal(buildOccurrenceSeries1097(rows,7,now).reduce((s,p)=>s+p.count,0),0);
 const month=buildOccurrenceSeries1097(rows,30,now);
 assert.equal(month.length,30);
 assert.equal(month.reduce((s,p)=>s+p.count,0),1);
});
test("empty routine period has no fictitious completion percentage",async()=>{
 const {summarizeRoutines1097}=await load();
 assert.deepEqual(summarizeRoutines1097({date:"2026-11-25",scope:"local",tasks:[]}),{total:0,completed:0,pending:0,percent:null});
});
test("routine completions are unique by task and never exceed denominator",async()=>{
 const {summarizeRoutines1097}=await load();
 const snapshot={date:"2026-11-25",scope:"central",tasks:[{id:"a",done:true},{id:"a",done:false},{id:"b",done:false},{id:"c",done:true}]};
 const frozen=JSON.stringify(snapshot);
 assert.deepEqual(summarizeRoutines1097(snapshot),{total:3,completed:2,pending:1,percent:67});
 assert.equal(JSON.stringify(snapshot),frozen);
});
