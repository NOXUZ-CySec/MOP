'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {create}=require('../desktop/reminder-window97.cjs');
test('MOP reminder test shows independent always-on-top window, then closes',async()=>{
 const handlers={};const windows=[];
 class FakeWeb extends EventEmitter {
  constructor(){super();this.session={setPermissionRequestHandler:()=>{}};this.messages=[]}
  setWindowOpenHandler(){}
  isLoading(){return false}
  send(...args){this.messages.push(args)}
 }
 class FakeWindow extends EventEmitter {
  constructor(opts){super();this.options=opts;this.webContents=new FakeWeb();this.top=[];this.shown=false;this.closed=false;windows.push(this)}
  setAlwaysOnTop(...args){this.top.push(args)}
  show(){this.shown=true}
  moveTop(){this.moved=true}
  focus(){this.focused=true}
  flashFrame(){}
  isDestroyed(){return this.closed}
  close(){this.closed=true;this.emit('closed')}
  async loadFile(){this.webContents.emit('did-finish-load');return true}
 }
 const main=create({BrowserWindow:FakeWindow,ipcMain:{handle:(name,fn)=>handlers[name]=fn,removeHandler:name=>delete handlers[name]},getContext:()=>({session:{userId:'user-1',role:'supervisor'},store:{db:{}}}),getTasks:async()=>({tasks:[],runs:[]}),complete:async()=>{}});
 try{
  assert.equal(main.showTest(),true);
  await Promise.resolve();
  assert.equal(windows.length,1);
  const w=windows[0];
  assert.equal(w.options.frame,false);
  assert.equal(w.options.alwaysOnTop,true);
  assert.equal(w.shown,true);
  assert.equal(w.moved,true);
  assert.equal(w.focused,true);
  assert.ok(w.top.some(x=>x[0]===true&&x[1]==='screen-saver'));
  assert.equal(w.webContents.messages[0][0],'mop:reminder97-show');
  const reply=await handlers['mop:reminder97-answer']({sender:w.webContents},'dismiss');
  assert.equal(reply.ok,true);
  assert.equal(w.closed,true);
 }finally{main.stop()}
});
