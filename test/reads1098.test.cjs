"use strict";
const {test,after}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {pathToFileURL}=require("node:url");
const source=()=>import(pathToFileURL(path.resolve(__dirname,"../ui-next/src/queries1098/readCoordinator1098.ts")).href);
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const results=[];
const check=(name,fn)=>test(name,async()=>{try{await fn();results.push({name,status:"passed"})}catch(error){results.push({name,status:"failed"});throw error}});
after(()=>{const out=path.resolve(__dirname,"../test-results/release1098");fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"reads-unit-report.json"),JSON.stringify({status:results.every(x=>x.status==="passed")?"passed":"failed",checks:results.length,details:results},null,2));});

check("Concurrent readers share one in-flight snapshot",async()=>{
 const {ReadCoordinator1098}=await source();const reader=new ReadCoordinator1098();reader.setScope("A");
 const pending=defer();let calls=0;const load=()=>{calls++;return pending.promise};
 const a=reader.request("A",load),b=reader.request("A",load);assert.equal(a,b);await tick();assert.equal(calls,1);
 pending.resolve({revision:1});const result=await a;assert.equal(result.value.revision,1);assert.equal(reader.isCurrent(result),true);
});
check("Repeated invalidations during a read produce one trailing refresh",async()=>{
 const {ReadCoordinator1098}=await source();const reader=new ReadCoordinator1098();reader.setScope("A");
 const waiting=[];const load=()=>{const x=defer();waiting.push(x);return x.promise};
 const first=reader.request("A",load);await tick();
 const second=reader.request("A",load,{invalidate:true});const third=reader.request("A",load,{invalidate:true});
 assert.equal(first,second);assert.equal(second,third);waiting[0].resolve("old");await tick();assert.equal(waiting.length,2);
 waiting[1].resolve("fresh");const result=await first;assert.equal(result.value,"fresh");assert.equal(waiting.length,2);
});
check("Invalidations before work starts are coalesced into the initial read",async()=>{
 const {ReadCoordinator1098}=await source();const reader=new ReadCoordinator1098();reader.setScope("A");let calls=0;
 const load=async()=>++calls;const a=reader.request("A",load);reader.request("A",load,{invalidate:true});
 assert.equal((await a).value,1);assert.equal(calls,1);
});
check("Changing identity discards a late snapshot and rejects stale callbacks",async()=>{
 const {ReadCoordinator1098}=await source();const reader=new ReadCoordinator1098();reader.setScope("A");const old=defer();
 const a=reader.request("A",()=>old.promise);await tick();reader.setScope("B");
 const b=await reader.request("B",async()=>"user B");old.resolve("user A");assert.equal((await a).status,"discarded");assert.equal(reader.isCurrent(b),true);
 let invoked=false;assert.equal((await reader.request("A",async()=>{invoked=true})).status,"discarded");assert.equal(invoked,false);
});
check("Logout discards both an old failure and cached data",async()=>{
 const {ReadCoordinator1098}=await source();const reader=new ReadCoordinator1098();reader.setScope("A");const pending=defer();
 const request=reader.request("A",()=>pending.promise);await tick();reader.clearScope("A");pending.reject(Error("old error"));assert.equal((await request).status,"discarded");
 reader.setScope("A");let calls=0;const result=await reader.request("A",async()=>++calls,{maxAgeMs:1000});assert.equal(result.value,1);assert.equal(calls,1);
});
check("Scoped short cache expires and explicit refresh bypasses it",async()=>{
 const {ReadCoordinator1098}=await source();const reader=new ReadCoordinator1098();reader.setScope("A");let clock=0,calls=0;
 const load=async()=>++calls,options={maxAgeMs:1000,now:()=>clock};
 assert.equal((await reader.request("A",load,options)).value,1);clock=500;assert.equal((await reader.request("A",load,options)).value,1);
 assert.equal((await reader.request("A",load,{...options,invalidate:true})).value,2);clock=1600;assert.equal((await reader.request("A",load,options)).value,3);
 reader.setScope("B");assert.equal((await reader.request("B",load,options)).value,4);
});
check("Read errors remain explicit and are not cached",async()=>{
 const {ReadCoordinator1098}=await source();const reader=new ReadCoordinator1098();reader.setScope("A");
 const failure=await reader.request("A",async()=>{throw Error("failure")},{maxAgeMs:1000});assert.equal(failure.status,"error");assert.equal(failure.error.message,"failure");
 const success=await reader.request("A",async()=>"recovered",{maxAgeMs:1000});assert.equal(success.value,"recovered");assert.equal(reader.isCurrent(failure),false);
});
check("A failed obsolete attempt does not replace its queued fresh result",async()=>{
 const {ReadCoordinator1098}=await source();const reader=new ReadCoordinator1098();reader.setScope("A");const pending=defer();let calls=0;
 const load=()=>++calls===1?pending.promise:Promise.resolve("fresh");const request=reader.request("A",load);await tick();reader.request("A",load,{invalidate:true});
 pending.reject(Error("superseded"));assert.equal((await request).value,"fresh");assert.equal(calls,2);
});
check("Completed outcomes lose authority when a newer read starts",async()=>{
 const {ReadCoordinator1098}=await source();const reader=new ReadCoordinator1098();reader.setScope("A");
 const old=await reader.request("A",async()=>1);const pending=defer();const fresh=reader.request("A",()=>pending.promise);
 assert.equal(reader.isCurrent(old),false);pending.resolve(2);assert.equal((await fresh).value,2);
});
check("Re-entering the same scope after logout uses a new epoch",async()=>{
 const {ReadCoordinator1098}=await source();const reader=new ReadCoordinator1098();const scope={};reader.setScope(scope);const old=defer();
 const first=reader.request(scope,()=>old.promise);await tick();reader.setScope(null);reader.setScope(scope);
 const next=await reader.request(scope,async()=>"new login");old.resolve("previous login");assert.equal((await first).status,"discarded");assert.equal(reader.isCurrent(next),true);
});
check("Routine partition uses Sao Paulo day and shift boundaries",async()=>{
 const {routinePartition1098}=await source();
 assert.equal(routinePartition1098(new Date("2026-11-25T02:59:59Z")),"2026-11-24|night");
 assert.equal(routinePartition1098(new Date("2026-11-25T03:00:00Z")),"2026-11-25|night");
 assert.equal(routinePartition1098(new Date("2026-11-25T08:59:59Z")),"2026-11-25|night");
 assert.equal(routinePartition1098(new Date("2026-11-25T09:00:00Z")),"2026-11-25|day");
 assert.equal(routinePartition1098(new Date("2026-11-25T21:00:00Z")),"2026-11-25|night");
});
check("Routine cache key separates account, scope, login and calendar day",async()=>{
 const {createReadSession1098,routineReadKey1098}=await source();const account={userId:"A",role:"operator",condos:["B","A"]};
 const a=createReadSession1098(account),b=createReadSession1098({...account,condos:["A","B"]});assert.equal(a.key,b.key);assert.notEqual(a.id,b.id);
 const time=new Date("2026-11-25T15:00:00Z");assert.notEqual(routineReadKey1098(a,time),routineReadKey1098(b,time));
 assert.notEqual(a.key,createReadSession1098({...account,role:"viewer"}).key);assert.notEqual(a.key,createReadSession1098({...account,userId:"C"}).key);
 assert.notEqual(createReadSession1098({...account,condos:null}).key,createReadSession1098({...account,condos:[]}).key);
 assert.notEqual(routineReadKey1098(a,time),routineReadKey1098(a,new Date("2026-11-26T15:00:00Z")));
});
check("No active scope performs no read",async()=>{
 const {ReadCoordinator1098}=await source();const reader=new ReadCoordinator1098();let calls=0;
 assert.equal((await reader.request(null,async()=>++calls)).status,"discarded");assert.equal(calls,0);
});
