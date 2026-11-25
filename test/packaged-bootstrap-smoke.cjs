'use strict';
const {spawn,execFileSync}=require('node:child_process');
const path=require('node:path');
const assert=require('node:assert/strict');
const exe=process.argv.includes('--portable')?path.join(__dirname,'..','dist-homologacao-12','MOP-Executavel-2.3.0-preview.12.exe'):path.join(__dirname,'..','dist-homologacao-12','win-unpacked','MOP Preview Homologacao 12.exe');
const port=9339;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const child=spawn(exe,['--remote-debugging-port='+port,'--remote-debugging-address=127.0.0.1'],{stdio:'ignore'});
let ws,serial=0;
async function connect(){
 for(let i=0;i<240;i++){
   await sleep(125);
   try{
     const res=await fetch('http://127.0.0.1:'+port+'/json/list');
     const tabs=await res.json();const tab=tabs.find(x=>x.type==='page'&&x.url.includes('index-demo.html'));
     if(!tab)continue;
     ws=new WebSocket(tab.webSocketDebuggerUrl);
     await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
     return tab;
   }catch{}
 }
 throw Error('Chromium remote debug tab was not found.');
}
async function evalPage(expression){
 const id=++serial;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('CDP timeout: '+expression.slice(0,100))),9000);
  const handler=ev=>{
   try{const m=JSON.parse(ev.data);if(m.id!==id)return;
    ws.removeEventListener('message',handler);clearTimeout(timer);
    if(m.error||m.result?.exceptionDetails)return reject(Error(JSON.stringify(m.error||m.result?.exceptionDetails)));
    resolve(m.result?.result?.value);
   }catch(e){reject(e);}
  };
  ws.addEventListener('message',handler);
  ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));
 });
}
const until=async test=>{for(let i=0;i<70;i++){const result=await test();if(result)return result;await sleep(150);}throw Error('Timed out waiting for state');};
(async()=>{
 try{
  const tab=await connect(); console.log('PACKAGED_TAB',tab.url.replace(/F:\/[^\/]+/,'F:/...'));
  const login=await until(()=>evalPage("document.querySelector('#startup')?.dataset.state==='login'"));
  assert.equal(login,true);
  console.log('PACKAGED_BOOTSTRAP_OK login form shown without origin denial');
  await evalPage("(()=>{const e=document.querySelector('#loginEmail'),p=document.querySelector('#loginPassword');e.value='admin.teste';p.value='MOP-Demo-2026!';document.querySelector('#loginUpload').checked=true;document.querySelector('#loginForm').requestSubmit();return true})()");
  await until(()=>evalPage("document.querySelector('#startup')?.hidden===true||document.querySelector('#startup')?.dataset.state==='error'"));
  const snapshot=await evalPage("(()=>({state:document.querySelector('#startup').dataset.state,error:document.querySelector('#startupError')?.textContent,role:window.mopAccount?.role,items:window.mopAccount?readStore().items.length:null}))()");
  console.log('PACKAGED_SNAPSHOT',JSON.stringify(snapshot));
  assert.equal(snapshot.state,'ready');assert.equal(snapshot.role,'admin');assert.ok(snapshot.items>=14);
  console.log('PACKAGED_LOGIN_OK');
 }catch(e){console.error('PACKAGED_SMOKE_FAILED',e);process.exitCode=1;}
 finally{
  try{ws?.close();}catch{}
  try{execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});}catch{}
 }
})();
