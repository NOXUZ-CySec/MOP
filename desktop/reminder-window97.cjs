'use strict';
const path=require('node:path');
const model=require('./reminder97.cjs');
function create({BrowserWindow,ipcMain,getContext,getTasks,complete}){
 let popup=null,current=null,running=false;
 const close=()=>{const w=popup;popup=null;current=null;if(w&&!w.isDestroyed())w.close()};
 const show=(task,session,date,isTest=false)=>{
  if(popup&&!popup.isDestroyed()){popup.setAlwaysOnTop(true,'screen-saver');popup.show();popup.moveTop();popup.focus();return};
  current={taskId:String(task.id),userId:String(session.userId),date,isTest,reminder_revision:Number(task.reminder_revision||0)};
  const w=new BrowserWindow({width:500,height:310,minWidth:500,minHeight:310,frame:false,transparent:true,thickFrame:false,resizable:false,maximizable:false,minimizable:false,alwaysOnTop:true,focusable:true,skipTaskbar:false,autoHideMenuBar:true,show:false,title:'MOP · Lembrete de rotina',backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'reminder-preload97.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false}});
  popup=w;
  w.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  w.webContents.on('will-navigate',e=>e.preventDefault());
  w.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  let displayed=false;
  const display=()=>{
   if(displayed||w.isDestroyed()||popup!==w)return;
   displayed=true;
   w.setAlwaysOnTop(true,'screen-saver');
   w.show();
   w.moveTop();
   w.focus();
   w.flashFrame(true);
   w.webContents.send('mop:reminder97-show',{title:String(task.title).slice(0,120),time:String(task.reminder_time||'Agora').slice(0,5),date,isTest});
  };
  w.webContents.once('did-finish-load',display);
  w.once('ready-to-show',()=>{if(w.webContents.isLoading())return;display()});
  w.on('closed',()=>{if(w===popup){popup=null;current=null;}});
  w.loadFile(path.join(__dirname,'reminder-popup97.html')).catch(err=>{console.error('[MOP reminder97] Failed to load popup:',err.message);if(w===popup)close()});
 };
 const poll=async()=>{
  if(running)return;running=true;
  try{
   const ctx=getContext();
   if(!ctx){if(popup)close();return}
   const {store,session}=ctx;
   model.setup(store.db);
   if(popup&&!popup.isDestroyed()&&current?.userId!==session.userId)close();
   const now=model.clock(),list=await getTasks(session);
   const refreshed=getContext();if(!refreshed||refreshed.session.userId!==session.userId)return;
   const done=(list.runs||[]).map(r=>String(r.task_id));
   if(popup&&!popup.isDestroyed()){
    if(current?.isTest)return;
    if(current?.date!==now.date||done.includes(current?.taskId)||!(list.tasks||[]).some(t=>String(t.id)===current?.taskId&&Number(t.reminder_revision||0)===current?.reminder_revision)){close();return}
    return;
   }
   const task=(list.tasks||[]).find(t=>model.due(t,done,model.receipt(store.db,session.userId,t.id,now.date),now));
   if(task)show(task,session,now.date);
  }catch(err){console.error('[MOP reminder97]',err.message)}
  finally{running=false}
 };
 const showTest=()=>{
  const ctx=getContext();
  if(!ctx)throw Error('É necessário estar autenticado para testar o lembrete.');
  if(!['admin','supervisor'].includes(ctx.session.role))throw Error('Teste disponível somente à supervisão.');
  const now=model.clock();
  show({id:'mop-preview-test',title:'Teste de lembrete do MOP',reminder_time:now.time},ctx.session,now.date,true);
  return true;
 };
 ipcMain.handle('mop:reminder97-answer',async(event,action)=>{
  try{
   if(!popup||popup.isDestroyed()||event.sender!==popup.webContents||!current)throw Error('Janela de lembrete inválida.');
   if(!['complete','snooze','dismiss'].includes(action))throw Error('Ação não autorizada.');
   const ctx=getContext();if(!ctx||ctx.session.userId!==current.userId)throw Error('Sessão expirada. Entre novamente.');
   const {store,session}=ctx;
   if(!current.isTest){
    const updated=await getTasks(session);const activeTask=(updated.tasks||[]).find(t=>String(t.id)===current.taskId&&Number(t.reminder_revision||0)===current.reminder_revision);
    if(!activeTask)throw Error('O horário foi alterado. Feche este lembrete e aguarde o novo agendamento.');
    if(action==='complete')await complete(session,current.taskId);
    model.acknowledge(store.db,session.userId,current.taskId,current.date,action,Date.now(),current.reminder_revision);
   }
   close();return {ok:true,value:true};
  }catch(err){return {ok:false,error:String(err.message||err)}}
 });
 const timer=setInterval(()=>void poll(),20000);timer.unref?.();
 return {poll,showTest,close,stop:()=>{clearInterval(timer);close();ipcMain.removeHandler('mop:reminder97-answer')}};
}
module.exports={create};