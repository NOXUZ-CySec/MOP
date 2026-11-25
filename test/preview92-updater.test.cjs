'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const EventEmitter=require('node:events');
const {createUpdater92}=require('../desktop/updater92.cjs');
function fixture({packaged=true}={}){
 const updater=new EventEmitter();let checks=0,installs=0,resolveCheck,rejectCheck;
 updater.setFeedURL=config=>{updater.feed=config};
 updater.checkForUpdates=()=>{checks++;return new Promise((resolve,reject)=>{resolveCheck=resolve;rejectCheck=reject})};
 updater.quitAndInstall=(silent,restart)=>{installs++;updater.installFlags=[silent,restart]};
 const delays=[],repeat=[],events=[];
 const controller=createUpdater92({updater,isPackaged:packaged,getVersion:()=> '2.3.0-preview.92',notify:status=>events.push(status),setDelay:fn=>{delays.push(fn);return {unref(){}}},setRepeating:fn=>{repeat.push(fn);return {unref(){}}},privacyMessage:message=>message});
 return {updater,controller,delays,repeat,events,resolve:()=>resolveCheck?.(),reject:e=>rejectCheck?.(e),checks:()=>checks,installs:()=>installs};
}
test('Preview92 schedules exactly one startup and periodic check',()=>{
 const f=fixture();f.controller.configure();f.controller.configure();
 assert.equal(f.delays.length,1);assert.equal(f.repeat.length,1);
 assert.equal(f.updater.feed.repo,'MOP');assert.equal(f.updater.allowPrerelease,true);
 assert.equal(f.updater.autoDownload,true);assert.equal(f.updater.autoInstallOnAppQuit,false);
});
test('Preview92 deduplicates concurrent checks and refuses to re-check during a download',async()=>{
 const f=fixture();f.controller.configure();const p=f.controller.check(),q=f.controller.check();
 assert.equal(f.checks(),1);
 f.updater.emit('update-available',{version:'2.3.0-preview.93'});
 assert.equal(f.controller.state().state,'available');
 assert.equal((await f.controller.check()).state,'available');assert.equal(f.checks(),1);
 f.updater.emit('download-progress',{percent:28.9});
 assert.equal(f.controller.state().percent,29);
 await f.controller.check();assert.equal(f.checks(),1);
 f.resolve();await Promise.all([p,q]);
});
test('Preview92 preserves downloaded update until explicit install and installs once',async()=>{
 const f=fixture();f.controller.configure();
 f.updater.emit('update-downloaded',{version:'2.3.0-preview.93'});
 f.updater.emit('update-not-available');
 assert.equal(f.controller.state().state,'ready');
 assert.equal(f.controller.state().version,'2.3.0-preview.93');
 assert.equal((await f.controller.check()).state,'ready');assert.equal(f.checks(),0);
 assert.equal(f.controller.install(),true);assert.equal(f.controller.state().state,'installing');
 assert.throws(()=>f.controller.install(),/Nenhuma atualização/);
 assert.equal(f.delays.length,2);
 f.delays[1]();assert.equal(f.installs(),1);
 assert.deepEqual(f.updater.installFlags,[true,true]);
});
test('Preview92 makes check and installation errors visible and retryable',async()=>{
 const f=fixture();f.controller.configure();
 const request=f.controller.check();f.reject(Error('Falha simulada'));
 const result=await request;assert.equal(result.state,'error');assert.match(result.message,/Falha simulada/);
 const retry=f.controller.check();assert.equal(f.checks(),2);f.resolve();await retry;
 f.updater.emit('update-downloaded',{version:'2.3.0-preview.93'});
 f.updater.quitAndInstall=()=>{throw Error('Falha no instalador')};
 f.controller.install();f.delays[1]();
 assert.equal(f.controller.state().state,'error');assert.match(f.controller.state().message,/Falha no instalador/);
});
test('Preview92 dev mode never tries to install or query GitHub',async()=>{
 const f=fixture({packaged:false});assert.equal((await f.controller.check()).state,'dev');
 assert.equal(f.checks(),0);assert.equal(f.delays.length,0);assert.throws(()=>f.controller.install());
});