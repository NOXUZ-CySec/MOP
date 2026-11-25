'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('Create-record IPC awaits the response and returns its value',async()=>{
 const preload=fs.readFileSync(path.join(__dirname,'../desktop/preload-next43.cjs'),'utf8');
 const exposed={};
 const context={require:(name)=>{assert.equal(name,'electron');return {contextBridge:{exposeInMainWorld:(key,value)=>{exposed[key]=value}},ipcRenderer:{invoke:async(channel,input)=>{assert.equal(channel,'mop:record-create43');assert.equal(input.subject,'Teste');return {ok:true,value:{id:7,protocol:'MOP-TESTE'}}},on:()=>{},removeListener:()=>{},sendSync:()=>{}}}}};
 vm.runInNewContext(preload,context,{filename:'preload-next43.cjs'});
 assert.deepEqual(JSON.parse(JSON.stringify(await exposed.mopDesktop.createRecord43({subject:'Teste'}))),{id:7,protocol:'MOP-TESTE'});
});
test('Create-record IPC propagates server errors',async()=>{
 const preload=fs.readFileSync(path.join(__dirname,'../desktop/preload-next43.cjs'),'utf8');const exposed={};
 const context={require:()=>({contextBridge:{exposeInMainWorld:(key,value)=>exposed[key]=value},ipcRenderer:{invoke:async()=>({ok:false,error:'Permissão negada'}),on:()=>{},removeListener:()=>{},sendSync:()=>{}}})};
 vm.runInNewContext(preload,context);
 await assert.rejects(exposed.mopDesktop.createRecord43({}),/Permissão negada/);
});
