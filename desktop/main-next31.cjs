'use strict';
const {app,BrowserWindow,Menu,ipcMain}=require('electron');
const path=require('node:path');
const {fileURLToPath}=require('node:url');
app.setPath('userData',path.join(app.getPath('appData'),'MOP-UI-Next-Preview31'));
if(!app.requestSingleInstanceLock()){app.quit()}else{
 app.whenReady().then(()=>{
  Menu.setApplicationMenu(null);
  const win=new BrowserWindow({width:1440,height:900,minWidth:360,minHeight:620,frame:false,backgroundColor:'#071322',title:'MOP Preview.31 — UI Next',autoHideMenuBar:true,show:false,webPreferences:{preload:path.join(__dirname,'preload-next31.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  const authorized=(event)=>{if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Untrusted frame');const u=new URL(event.senderFrame.url);const expected=path.resolve(__dirname,'../ui-next/dist/index.html');if(u.protocol!=='file:'||path.normalize(fileURLToPath(u)).toLowerCase()!==path.normalize(expected).toLowerCase())throw Error('Untrusted page');};
  ipcMain.handle('mop-next:window',async(event,action)=>{
   authorized(event);
   if(action==='minimize'){win.minimize();return {maximized:win.isMaximized()}}
   if(action==='maximize'){win.isMaximized()?win.unmaximize():win.maximize();return {maximized:win.isMaximized()}}
   if(action==='close'){win.close();return {maximized:false}}
   if(action==='status')return {maximized:win.isMaximized()};
   throw Error('Invalid window action');
  });
  win.loadFile(path.join(__dirname,'../ui-next/dist/index.html'));
  win.once('ready-to-show',()=>win.show());
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
 });
 app.on('window-all-closed',()=>app.quit());
}