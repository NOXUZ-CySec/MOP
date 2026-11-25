'use strict';
const {app,BrowserWindow,ipcMain,dialog,shell,Menu,powerMonitor,safeStorage,Notification,MenuItem} = require('electron');
const {autoUpdater}=require('electron-updater');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {Store} = require('./store.cjs');
const {visible,stampWrite}=require('./operations.cjs');
const operations=require('../src/operations.js');
const fs=require('node:fs');
const privacy=require('../src/privacy.js');
let store,win,sync,access,readVersion;
let alertTimer;
let updaterReady=false;
let updateState={state:'idle',version:null,percent:0,message:'Atualizações automáticas prontas.'};
const index = path.join(__dirname,'../ui-next/dist/index.html');
const indexURL = pathToFileURL(index).href;
// Caminho estável, independente da versão e da pasta do instalador.
app.setPath('userData',path.join(app.getPath('appData'),'MOP-UI-Next-Preview35'));
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
  app.whenReady().then(()=>{
    try {
      let windowShown;
      const shown = new Promise(resolve=>{windowShown=resolve;});
      const trusted = event => {
        if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== indexURL) throw Error('Origem não autorizada.');
      };
      const response = (event,fn) => {try{trusted(event);return {ok:true,value:fn()};}catch(e){return {ok:false,error:privacy.clean(e.message)};}};
      const sendUpdate=(patch={})=>{updateState={...updateState,...patch};if(win&&!win.isDestroyed())win.webContents.send('mop:update-status',updateState);};
      const setupUpdater=()=>{if(true)return;updaterReady=true;autoUpdater.autoDownload=true;autoUpdater.autoInstallOnAppQuit=true;autoUpdater.allowPrerelease=false;autoUpdater.on('checking-for-update',()=>sendUpdate({state:'checking',message:'Verificando atualizações…'}));autoUpdater.on('update-available',info=>sendUpdate({state:'available',version:info.version,message:'Nova versão '+info.version+' encontrada. Download iniciado.'}));autoUpdater.on('update-not-available',()=>sendUpdate({state:'current',version:app.getVersion(),percent:0,message:'Você já está usando a versão mais recente.'}));autoUpdater.on('download-progress',p=>sendUpdate({state:'downloading',percent:Math.round(p.percent||0),message:'Baixando atualização… '+Math.round(p.percent||0)+'%'}));autoUpdater.on('update-downloaded',info=>sendUpdate({state:'ready',version:info.version,percent:100,message:'Atualização '+info.version+' pronta para instalar.'}));autoUpdater.on('error',error=>sendUpdate({state:'error',message:'Não foi possível verificar atualizações agora: '+privacy.clean(error.message)}));setTimeout(()=>autoUpdater.checkForUpdates().catch(()=>{}),5000);setInterval(()=>autoUpdater.checkForUpdates().catch(()=>{}),6*60*60*1000).unref();};
      const authorized=()=>{if(!access)throw Error('Entre com seu e-mail e senha para acessar o MOP.');return access.require();};
      let notificationService;
      ipcMain.handle('mop:notifications',(event,action,input)=>response(event,()=>{
        const session=authorized();
        notificationService ||= new (require('./intelligence.cjs').Intelligence)(store);
        if(action==='snapshot')return notificationService.snapshot(session);
        if(action==='read')return notificationService.mark(session,input?.key);
        if(action==='readAll')return notificationService.markAll(session);
        throw Error('Ação desconhecida.');
      }));
      ipcMain.handle('mop:shown',async event=>{
        try {trusted(event);await shown;return {ok:true,value:true};}
        catch(error){return {ok:false,error:error.message};}
      });
      ipcMain.handle('mop:initialize',async event=>{
        try {
          trusted(event);
          await shown;
          if(!store){
            let candidate;
            try {
              candidate=new Store(path.join(app.getPath('userData'),'dados'));
              candidate.backup();
              store=candidate;
            } catch(error) { if(candidate)candidate.close(); throw error; }
          }
          synchronization();
          return {ok:true,value:access.status()};
        } catch(error) { return {ok:false,error:'Não foi possível abrir o banco local. Tente novamente ou consulte o responsável pelo MOP. Os dados foram preservados.'}; }
      });
      const synchronization=()=>{
        if(!store)throw Error('Banco local ainda não está pronto.');
        if(!sync){
          const {SyncEngine}=require('./sync-engine.cjs');
          sync=new SyncEngine(store,{safeStorage,notify:status=>{if(access?.session&&win&&!win.isDestroyed())win.webContents.send('mop:sync-status',status);}});
          const {Access}=require('./access.cjs');
          access=new Access(sync,{safeStorage,onLock:()=>{readVersion=undefined;if(win&&!win.isDestroyed())win.webContents.send('mop:locked');}});
          sync.mayRun=()=>!!access.session;
          sync.onAccessDenied=()=>access.revoke();
        }
        return sync;
      };
      ipcMain.handle('mop:update-status',event=>response(event,()=>updateState));
      ipcMain.handle('mop:update-check',async event=>{try{trusted(event);if(true)return {ok:true,value:{...updateState,state:'dev',message:'Atualizações automáticas funcionam no aplicativo instalado.'}};setupUpdater();await autoUpdater.checkForUpdates();return {ok:true,value:updateState};}catch(e){return {ok:false,error:privacy.clean(e.message)};}});
      ipcMain.handle('mop:update-install',event=>{try{trusted(event);if(updateState.state!=='ready')throw Error('Nenhuma atualização está pronta para instalar.');setImmediate(()=>autoUpdater.quitAndInstall(false,true));return {ok:true,value:true};}catch(e){return {ok:false,error:privacy.clean(e.message)};}});
      ipcMain.handle('mop:auth-status',event=>{try{trusted(event);synchronization();return {ok:true,value:access.status()};}catch{return {ok:false,error:'Não foi possível preparar o login.'};}});
      ipcMain.handle('mop:auth-login',async(event,input)=>{
        try{trusted(event);synchronization();return {ok:true,value:await access.login(input)};}
        catch(e){return {ok:false,error:privacy.clean(e.message)};}
      });
      ipcMain.handle('mop:auth-logout',async event=>{try{trusted(event);if(access)await access.lock();return {ok:true,value:true};}catch{return {ok:false,error:'Não foi possível encerrar a sessão.'};}});
      for(const [name,action] of Object.entries({
        status:()=>synchronization().status(),
        connect:()=>{throw Error('Use a tela de login para entrar no MOP.');},
        disconnect:async()=>{await access.lock();return {authenticated:false};},
        now:async()=>{await synchronization().kick();return sync.status();},
        conflicts:()=>{const s=visible(store.read(),authorized());return privacy.clean(synchronization().local.conflicts().filter(c=>s[c.kind]?.some(x=>x.id===c.localId)));},
        resolve:input=>{const session=authorized(),s=visible(store.read(),session),c=sync.local.conflicts().find(c=>c.id===input.id);if(session.role==='viewer'||!c||!s[c.kind]?.some(x=>x.id===c.localId))throw Error('Conflito fora do seu acesso.');return synchronization().resolve(input.id,input.choice,input.version);}
      }))ipcMain.handle('mop:sync-'+name,async(event,input)=>{try{trusted(event);authorized();const value=await action(input);if(name!=='disconnect')authorized();return {ok:true,value};}catch(e){return {ok:false,error:privacy.clean(e.message)};}});
      ipcMain.on('mop:read',event=>{event.returnValue=response(event,()=>{const session=authorized();const state=store.read();readVersion=JSON.stringify(state);return visible(state,session);});});
      ipcMain.on('mop:write',(event,state)=>{event.returnValue=response(event,()=>{
        authorized();
        if(sync?.local.bound()&&readVersion!==JSON.stringify(store.read()))throw Error('Os dados foram atualizados por outra máquina. Atualize a tela e tente novamente.');
        const next=stampWrite(store.read(),state,authorized());store.write(next);readVersion=JSON.stringify(next);if(sync){sync.emit();sync.kick();}return true;
      });});
      ipcMain.handle('mop:export',async event=>{
        try {
          trusted(event);const session=authorized();if(!['supervisor','admin'].includes(session.role))throw Error('Salvar backup está disponível apenas para supervisores e administradores.');if(session.condos!==null&&session.condos!==undefined)throw Error('Backup integral disponível apenas para supervisores ou administradores com acesso a toda a central. Use Relatórios para exportar seu escopo.');
          const result = await dialog.showSaveDialog(win,{title:'Salvar backup do MOP',defaultPath:path.join(app.getPath('documents'),'MOP-backup-'+new Date().toISOString().slice(0,10)+'.json'),filters:[{name:'Backup MOP',extensions:['json']}]});
          authorized();
          if(result.canceled)return {ok:true,value:false};
          store.exportTo(result.filePath);return {ok:true,value:true};
        } catch(e){return {ok:false,error:privacy.clean(e.message)};}
      });
      ipcMain.handle('mop:open-data',async event=>{try{trusted(event);if(authorized().role!=='admin')throw Error('Somente administradores podem abrir a pasta de dados.');const error=await shell.openPath(store.directory);if(error)throw Error(error);return {ok:true,value:true};}catch(e){return {ok:false,error:privacy.clean(e.message)};}});
      ipcMain.handle('mop:management',async(event,action,input)=>{
        try{trusted(event);if(authorized().role!=='admin')throw Error('Acesso exclusivo de administradores.');
          if(!['list','save'].includes(action))throw Error('Ação inválida.');
          const params=action==='list'?{p_workspace:sync.workspace()}:{p_workspace:sync.workspace(),p_user_id:input.user_id,p_username:input.username,p_display_name:input.display_name,p_role:input.role,p_condos:input.condos};
          const {data,error}=await sync.client.rpc(action==='list'?'mop_list_members':'mop_set_operator_220',params);if(error)throw error;authorized();return {ok:true,value:privacy.clean(data)};
        }catch(e){return {ok:false,error:privacy.clean(e.message)};}
      });
      ipcMain.handle('mop:download',async(event,input)=>{
        let preview;
        try{trusted(event);const session=authorized();const state=visible(store.read(),session);let data,extension,name;
          if(input.type==='attachment'){
            const attachment=state.attachments.find(x=>x.id===input.id);if(!attachment)throw Error('Anexo indisponível.');
            require('./operations.cjs').validateAttachment(attachment);data=Buffer.from(attachment.content,'base64');name=attachment.name;extension=name.split('.').at(-1);
          }else if(input.type==='csv'){data=operations.csv(state,input.filters);extension='csv';name='MOP-relatorio.csv';}
          else if(input.type==='xlsx'){data=require('../src/workbook.js').report(operations.select(state,input.filters));extension='xlsx';name='MOP-relatorio.xlsx';}
          else if(input.type==='pdf'){
            extension='pdf';name='MOP-relatorio.pdf';
            preview=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
            preview.webContents.setWindowOpenHandler(()=>({action:'deny'}));
            await preview.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(operations.report(state,input.filters)));
            data=await preview.webContents.printToPDF({printBackground:true,pageSize:'A4',margins:{top:0.4,bottom:0.4,left:0.4,right:0.4},displayHeaderFooter:false});
          }else throw Error('Formato inválido.');
          const result=await dialog.showSaveDialog(win,{title:'Salvar arquivo',defaultPath:path.join(app.getPath('documents'),name),filters:[{name:'Arquivo '+extension.toUpperCase(),extensions:[extension]}]});
          authorized();if(result.canceled)return {ok:true,value:false};fs.writeFileSync(result.filePath,data);return {ok:true,value:true};
        }catch(e){return {ok:false,error:privacy.clean(e.message)};}finally{if(preview&&!preview.isDestroyed())preview.destroy();}
      });
      ipcMain.on('mop-next:window-command',(event,action)=>{try{trusted(event);if(action==='close'&&win&&!win.isDestroyed())win.destroy()}catch(error){console.error('[MOP] Close window rejected:',error.message)}});
      ipcMain.handle('mop-next:window-command',(event,action)=>{trusted(event);if(!win||win.isDestroyed())throw Error('Janela indisponível');if(action==='minimize')win.minimize();else if(action==='maximize'){win.isMaximized()?win.unmaximize():win.maximize()}else if(action!=='status')throw Error('Ação de janela inválida');return {maximized:win.isMaximized(),minimized:win.isMinimized()};});
      ipcMain.handle('mop-next:window',(event,action)=>{trusted(event);if(action==='minimize')win.minimize();else if(action==='maximize'){win.isMaximized()?win.unmaximize():win.maximize()}else if(action==='close'){win.destroy();return {maximized:false,closed:true};}else if(action!=='status')throw Error('Invalid window action');return {maximized:!win.isDestroyed()&&win.isMaximized()};});
      win = new BrowserWindow({width:1440,height:900,minWidth:360,minHeight:620,frame:false,backgroundColor:'#071322',title:'MOP — desenvolvido por NOXUZ',icon:path.join(__dirname,'../assets/icon.ico'),show:false,webPreferences:{preload:path.join(__dirname,'preload-next35.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,spellcheck:true}});
      Menu.setApplicationMenu(null);
      win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
      win.webContents.on('will-navigate',(event,url)=>{if(url!==indexURL)event.preventDefault();});
      win.webContents.on('did-start-navigation',(_event,_url,_inPlace,isMainFrame)=>{if(isMainFrame&&access?.session)access.lock();});
      win.webContents.on('render-process-gone',()=>{if(access)access.lock();});
      win.webContents.on('will-attach-webview',event=>event.preventDefault());
      win.webContents.session.setSpellCheckerEnabled(true);
      win.webContents.session.setSpellCheckerLanguages(['pt-BR']);
      win.webContents.on('context-menu',(_event,params)=>{if(!params.isEditable)return;const menu=new Menu();for(const suggestion of params.dictionarySuggestions||[])menu.append(new MenuItem({label:suggestion,click:()=>win.webContents.replaceMisspelling(suggestion)}));if(params.misspelledWord){if(menu.items.length)menu.append(new MenuItem({type:'separator'}));menu.append(new MenuItem({label:'Adicionar ao dicionário',click:()=>win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)}));}if(menu.items.length)menu.popup({window:win});});
      win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
      win.webContents.session.setPermissionCheckHandler(()=>false);
      win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{const dictionary=/^https:\/\/(?:redirector\.gvt1\.com|dl\.google\.com)\/(?:dl\/)?edgedl\/chrome\/dict\/[a-z0-9-]+\.bdic(?:\?.*)?$/i.test(details.url);callback({cancel:!dictionary});});
      win.once('ready-to-show',()=>{win.show();windowShown();});
      powerMonitor.on('resume',()=>{if(win&&!win.isDestroyed())win.webContents.send('mop:resume');});
      powerMonitor.on('lock-screen',()=>{if(access)access.lock();});
      powerMonitor.on('suspend',()=>{if(access)access.lock();});
      win.loadFile(index);
      alertTimer=setInterval(()=>{
        if(!access?.session||!store||!Notification.isSupported())return;
        try{
          const session=access.require(),alerts=operations.alerts(visible(store.read(),session));
          const signature=alerts.map(a=>[a.item.protocol,a.level,a.escalated,a.item.updated_at].join(':')).join('|');
          const key='alerts:'+session.userId;
          if(!signature||signature===sync.local.setting(key))return;
          sync.local.set(key,signature);
          const overdue=alerts.filter(a=>a.level==='late').length;
          const notification=new Notification({title:'MOP · Atenção às pendências',body:alerts.length+' alerta(s), '+overdue+' prazo(s) vencido(s). Abra o painel de alertas para conferir.'});
          notification.on('click',()=>{if(win&&!win.isDestroyed()){win.show();win.focus();win.webContents.send('mop:alert');}});notification.show();
        }catch{}
      },30000);alertTimer.unref();
    } catch(e) {
      dialog.showErrorBox('MOP — não foi possível iniciar',e.message+'\nOs dados existentes foram preservados. Consulte LEIA-ME.md para recuperação.');
      app.quit();
    }
  });
  app.on('window-all-closed',()=>app.quit());
  app.on('will-quit',()=>{clearInterval(alertTimer);if(access)access.close();if(sync)sync.close();if(store)store.close();});
}
