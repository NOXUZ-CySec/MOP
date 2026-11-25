'use strict';
const {app,BrowserWindow,ipcMain,dialog,shell,Menu,powerMonitor,safeStorage,Notification,MenuItem} = require('electron');
const {autoUpdater}=require('electron-updater');
const path = require('node:path');
const {pathToFileURL,fileURLToPath} = require('node:url');
const {Store} = require('./store.cjs');
const {visible,stampWrite}=require('./operations.cjs');
const operations=require('../src/operations.js');
const fs=require('node:fs');
const privacy=require('../src/privacy.js');
let store,win,sync,access,readVersion;
let alertTimer;
// Update state coordinated in updater92.cjs.
const index = path.join(__dirname,'../ui-next/dist/index.html');
const indexURL = pathToFileURL(index).href;
// Caminho estÃ¡vel, independente da versÃ£o e da pasta do instalador.
app.setPath('userData',path.join(app.getPath('appData'),'MOP-UI-Next-Homologacao'));
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
  app.whenReady().then(()=>{
    try {
      let windowShown;
      const shown = new Promise(resolve=>{windowShown=resolve;});
      const trusted = event => {
        if (!win || event.sender !== win.webContents || !event.senderFrame || event.senderFrame.parent !== null || !win.webContents.getURL().startsWith('file:') || path.normalize(fileURLToPath(win.webContents.getURL())).toLowerCase() !== path.normalize(index).toLowerCase()) throw Error('Origem nÃ£o autorizada.');
      };
      const response = (event,fn) => {try{trusted(event);return {ok:true,value:fn()};}catch(e){console.error('[MOP IPC]',e?.stack||e);return {ok:false,error:privacy.clean(e.message)};}};
       const updater92=require('./updater92.cjs').createUpdater92({updater:autoUpdater,isPackaged:app.isPackaged && !process.env.PORTABLE_EXECUTABLE_FILE /* Preview 95: update installed homologation builds; portable remains manually updated */,getVersion:()=>app.getVersion(),notify:status=>{if(win&&!win.isDestroyed())win.webContents.send('mop:update-status',status)},privacyMessage:value=>privacy.clean(value)});
      const authorized=()=>{if(!access)throw Error('Entre com seu e-mail e senha para acessar o MOP.');return access.require();};
      ipcMain.handle('mop:backup1098',require('./backup1098-ipc.cjs').createBackupController1098({
        trusted,getContext:()=>({session:authorized(),epoch:access.epoch,store,version:app.getVersion()}),
        getUserData:()=>app.getPath('userData'),safeStorage,openPath:directory=>shell.openPath(directory)
      }));
      let notificationService;
      ipcMain.handle('mop:notifications',async(event,action,input)=>{
        try{
          trusted(event);
          const session=authorized();
          notificationService ||=new (require('./intelligence.cjs').Intelligence)(store);
          const swap=require('./swap-notices94.cjs');
          let cloud=[];
          if(require('./shared-ops93.cjs').active(sync,session)){
            try{cloud=await swap.list(sync,session,store.db)}catch{cloud=[]}
          }
          authorized();
          if(action==='snapshot'){
            const result=notificationService.snapshot(session);
            const all=[...cloud,...result.history].sort((a,b)=>String(b.at||'').localeCompare(String(a.at||''))).slice(0,200);
            return {ok:true,value:{...result,notifications:[...cloud,...result.notifications],history:all}};
          }
          if(action==='read'){
            const key=String(input?.key||'');
            const value=cloud.some(n=>n.key===key)?swap.mark(store.db,session,cloud,key):notificationService.mark(session,key);
            return {ok:true,value};
          }
          if(action==='readAll'){
            notificationService.markAll(session);swap.markAll(store.db,session,cloud);
            return {ok:true,value:true};
          }
          throw Error('Ação desconhecida.');
        }catch(error){return {ok:false,error:privacy.clean(error.message)}}
      });
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
        } catch(error) { return {ok:false,error:'NÃ£o foi possÃ­vel abrir o banco local. Tente novamente ou consulte o responsÃ¡vel pelo MOP. Os dados foram preservados.'}; }
      });
      const synchronization=()=>{
        if(!store)throw Error('Banco local ainda nÃ£o estÃ¡ pronto.');
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
       ipcMain.handle('mop:update-notes',event=>response(event,()=>require('./release-notes.json')));
       ipcMain.handle('mop:update-status',event=>response(event,()=>updater92.state()));
       if(app.isPackaged)updater92.configure();
       ipcMain.handle('mop:update-check',async event=>{try{trusted(event);return {ok:true,value:await updater92.check()}}catch(e){return {ok:false,error:privacy.clean(e.message)}}});
       ipcMain.handle('mop:update-install',event=>response(event,()=>updater92.install()));
      ipcMain.handle('mop:recovery83',async(event,action,input)=>{try{trusted(event);if(access?.session)throw Error('Encerre a sessão antes de recuperar outra conta.');const recovery=require('./auth-recovery83.cjs');if(action==='request')return {ok:true,value:await recovery.request(input?.login)};if(action==='finish')return {ok:true,value:await recovery.finish(input?.link,input?.password)};throw Error('Ação de recuperação inválida.');}catch(e){return {ok:false,error:privacy.clean(e.message)}}});
      ipcMain.handle('mop:auth-status',event=>{try{trusted(event);synchronization();return {ok:true,value:access.status()};}catch{return {ok:false,error:'NÃ£o foi possÃ­vel preparar o login.'};}});
      ipcMain.handle('mop:auth-login',async(event,input)=>{
        try{trusted(event);synchronization();return {ok:true,value:await access.login(input)};}
        catch(e){return {ok:false,error:privacy.clean(e.message)};}
      });
      ipcMain.handle('mop:auth-logout',async event=>{try{trusted(event);if(access)await access.lock();return {ok:true,value:true};}catch{return {ok:false,error:'NÃ£o foi possÃ­vel encerrar a sessÃ£o.'};}});
      for(const [name,action] of Object.entries({
        status:()=>synchronization().status(),
        connect:()=>{throw Error('Use a tela de login para entrar no MOP.');},
        disconnect:async()=>{await access.lock();return {authenticated:false};},
        now:async()=>{await synchronization().kick();return sync.status();},
        conflicts:()=>{const s=visible(store.read(),authorized());return privacy.clean(synchronization().local.conflicts().filter(c=>s[c.kind]?.some(x=>x.id===c.localId)));},
        resolve:input=>{const session=authorized(),s=visible(store.read(),session),c=sync.local.conflicts().find(c=>c.id===input.id);if(session.role==='viewer'||!c||!s[c.kind]?.some(x=>x.id===c.localId))throw Error('Conflito fora do seu acesso.');return synchronization().resolve(input.id,input.choice,input.version);}
      }))ipcMain.handle('mop:sync-'+name,async(event,input)=>{try{trusted(event);authorized();const value=await action(input);if(name!=='disconnect')authorized();return {ok:true,value};}catch(e){return {ok:false,error:privacy.clean(e.message)};}});
      ipcMain.handle('mop:home109',async event=>{try{trusted(event);const session=authorized();const shared=require('./shared-ops93.cjs');const local=require('./checklist68.cjs');local.setup(store.db);let rows;if(shared.active(sync,session))rows=await shared.checklist(sync,session,'list');else{if(sync?.local?.bound())throw Error('Rotinas centrais indisponíveis. Reconecte ao Supabase para consultar as rotinas.');rows=local.action(store.db,session,'list')}authorized();return {ok:true,value:require('./home109.cjs').fromChecklist(rows)}}catch(error){return {ok:false,error:privacy.clean(error.message)}}});
      ipcMain.handle('mop:read48',event=>response(event,()=>{const session=authorized();const state=store.read();readVersion=JSON.stringify(state);return visible(state,session)}));
      ipcMain.on('mop:read',event=>{event.returnValue=response(event,()=>{const session=authorized();const state=store.read();readVersion=JSON.stringify(state);return visible(state,session);});});
      ipcMain.handle('mop:record-action96',(event,action,input)=>response(event,()=>{const session=authorized();if(!require('./startup-gate108.cjs').snapshot(store,session).accepted)throw Error('Confirme a ciência do turno antes de modificar registros.');const result=require('./record-actions96.cjs').action(store,session,action,input);readVersion=JSON.stringify(store.read());if(sync){sync.emit(true);sync.kick();}return result;}));
      ipcMain.handle('mop:record-create43',(event,input)=>response(event,()=>{
        const session=authorized();
        if(session.role==='viewer')throw Error('Perfil sem permissÃ£o de gravaÃ§Ã£o.');
        if(!require('./startup-gate108.cjs').snapshot(store,session).accepted)throw Error('Confirme a ciÃªncia das ocorrÃªncias prioritÃ¡rias antes de criar registros.');
        if(!input||typeof input!=='object')throw Error('Dados invÃ¡lidos.');
        const clean=(name,max,required=false)=>{const v=String(input[name]??'').trim();if(v.length>max||required&&!v)throw Error('Campo invÃ¡lido: '+name);return v;};
        const condo=clean('condo',100,true),subject=clean('subject',160,true),description=clean('description',3000,true),category=clean('category',80,true),action_taken=clean('action_taken',3000),status=clean('status',50,true);
        if(session.condos!=null&&!session.condos.includes(condo))throw Error('CondomÃ­nio fora do seu acesso.');
        if(!['Segurança','Sistemas','Rotina','Manutenção','Infraestrutura'].includes(category))throw Error('Categoria invÃ¡lida.');
        if(!['Pendente','Em andamento','Resolvido'].includes(status))throw Error('Status invÃ¡lido.');
        const state=store.read(),now=new Date().toISOString(),id=state.nextItem;
        const shiftInfo=require('../src/shift.js');
        const shift=shiftInfo.at(new Date());
        const record={id,protocol:'MOP-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+require('node:crypto').randomUUID().replaceAll('-','').slice(0,12).toUpperCase(),condo,company:'',category,subject,description,action_taken,next_action:'',source:'MOP UI Next',reference:'',status:status==='Resolvido'?'Resolvido':status,priority:'Normal',created_at:now,updated_at:now,created_shift:shift,updated_shift:shift};
        const next={...state,nextItem:id+1,items:[...state.items,record]};
        const stamped=stampWrite(state,next,session);
        store.write(stamped,session);
        readVersion=JSON.stringify(stamped);
        if(sync){try{sync.emit();sync.kick()}catch(err){console.error('Registro salvo; falha no envio de sincronizaÃ§Ã£o:',err.message)}}
        return {id,protocol:record.protocol};
      }));
      ipcMain.on('mop:write',(event,state)=>{event.returnValue=response(event,()=>{
        authorized();
        if(sync?.local.bound()&&readVersion!==JSON.stringify(store.read()))throw Error('Os dados foram atualizados por outra mÃ¡quina. Atualize a tela e tente novamente.');
        const next=stampWrite(store.read(),state,authorized());store.write(next);readVersion=JSON.stringify(next);if(sync){sync.emit();sync.kick();}return true;
      });});
      ipcMain.handle('mop:report-analytics106',async(event,filters={})=>{try{trusted(event);const session=authorized();require('./report-export105.cjs').authorize(session);const report=require('./report-export105.cjs').createData(store,session,{section:'analytics',period:'Todos os períodos',condo:filters.condo||'Todos os condomínios',category:filters.category||'Todas as categorias',status:filters.status||'Todos os status'});const days=Number(filters.days);if(![1,7,30].includes(days))throw Error('Período comparativo inválido.');const result=require('./report-analytics106.cjs').analyze(report.scoped.items.filter(x=>!x.deleted_at),{days,condo:report.condo,category:report.category,status:report.status});return {ok:true,value:result}}catch(e){return {ok:false,error:privacy.clean(e.message)}}});
      ipcMain.handle('mop:report-export105',async(event,format,filters)=>{
        try{
          trusted(event);const session=authorized();
          const exporter=require('./report-export105.cjs');
          exporter.authorize(session);
          if(!['pdf','xlsx'].includes(format))throw Error('Formato não autorizado.');
          const report=await exporter.enrichReport(exporter.createData(store,session,filters),store,sync,session);
          const extension=format==='pdf'?'pdf':'xlsx';
          const fileName='MOP-Relatorio-'+report.section+'-'+report.day+'.'+extension;
          const dest=await dialog.showSaveDialog(win,{title:'Exportar relatório do MOP',defaultPath:path.join(app.getPath('documents'),fileName),filters:[{name:format==='pdf'?'PDF':'Excel',extensions:[extension]}]});
          if(dest.canceled||!dest.filePath)return {ok:true,value:{saved:false,canceled:true}};
          const check=authorized();exporter.authorize(check);
          if(check.userId!==session.userId)throw Error('Sessão alterada durante a exportação.');
          await exporter.generate(report,format,dest.filePath);
          return {ok:true,value:{saved:true,filename:path.basename(dest.filePath),format}};
        }catch(e){return {ok:false,error:privacy.clean(e.message)}}
      });
      ipcMain.handle('mop:export',async event=>{
        try {
          trusted(event);const session=authorized();if(!['supervisor','admin'].includes(session.role))throw Error('Salvar backup estÃ¡ disponÃ­vel apenas para supervisores e administradores.');if(session.condos!==null&&session.condos!==undefined)throw Error('Backup integral disponÃ­vel apenas para supervisores ou administradores com acesso a toda a central. Use RelatÃ³rios para exportar seu escopo.');
          const result = await dialog.showSaveDialog(win,{title:'Salvar backup do MOP',defaultPath:path.join(app.getPath('documents'),'MOP-backup-'+new Date().toISOString().slice(0,10)+'.json'),filters:[{name:'Backup MOP',extensions:['json']}]});
          authorized();
          if(result.canceled)return {ok:true,value:false};
          store.exportTo(result.filePath);return {ok:true,value:true};
        } catch(e){return {ok:false,error:privacy.clean(e.message)};}
      });
      ipcMain.handle('mop:open-data',async event=>{try{trusted(event);if(authorized().role!=='admin')throw Error('Somente administradores podem abrir a pasta de dados.');const error=await shell.openPath(store.directory);if(error)throw Error(error);return {ok:true,value:true};}catch(e){return {ok:false,error:privacy.clean(e.message)};}});
      ipcMain.handle('mop:management',async(event,action,input)=>{
        try{trusted(event);if(authorized().role!=='admin')throw Error('Acesso exclusivo de administradores.');
          if(!['list','save'].includes(action))throw Error('AÃ§Ã£o invÃ¡lida.');
          const params=action==='list'?{p_workspace:sync.workspace()}:{p_workspace:sync.workspace(),p_user_id:input.user_id,p_username:input.username,p_display_name:input.display_name,p_role:input.role,p_condos:input.condos};
          const {data,error}=await sync.client.rpc(action==='list'?'mop_list_members':'mop_set_operator_220',params);if(error)throw error;authorized();return {ok:true,value:privacy.clean(data)};
        }catch(e){return {ok:false,error:privacy.clean(e.message)};}
      });
      ipcMain.handle('mop:download',async(event,input)=>{
        let preview;
        try{trusted(event);const session=authorized();const state=visible(store.read(),session);let data,extension,name;
          if(input.type==='attachment'){
            const attachment=state.attachments.find(x=>x.id===input.id);if(!attachment)throw Error('Anexo indisponÃ­vel.');
            require('./operations.cjs').validateAttachment(attachment);data=Buffer.from(attachment.content,'base64');name=attachment.name;extension=name.split('.').at(-1);
          }else if(input.type==='csv'){data=operations.csv(state,input.filters);extension='csv';name='MOP-relatorio.csv';}
          else if(input.type==='xlsx'){data=require('../src/workbook.js').report(operations.select(state,input.filters));extension='xlsx';name='MOP-relatorio.xlsx';}
          else if(input.type==='pdf'){
            extension='pdf';name='MOP-relatorio.pdf';
            preview=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
            preview.webContents.setWindowOpenHandler(()=>({action:'deny'}));
            await preview.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(operations.report(state,input.filters)));
            data=await preview.webContents.printToPDF({printBackground:true,pageSize:'A4',margins:{top:0.4,bottom:0.4,left:0.4,right:0.4},displayHeaderFooter:false});
          }else throw Error('Formato invÃ¡lido.');
          const result=await dialog.showSaveDialog(win,{title:'Salvar arquivo',defaultPath:path.join(app.getPath('documents'),name),filters:[{name:'Arquivo '+extension.toUpperCase(),extensions:[extension]}]});
          authorized();if(result.canceled)return {ok:true,value:false};fs.writeFileSync(result.filePath,data);return {ok:true,value:true};
        }catch(e){return {ok:false,error:privacy.clean(e.message)};}finally{if(preview&&!preview.isDestroyed())preview.destroy();}
      });

      const H36=require('../src/handover-automation.js');
      const shift36=require('../src/shift.js');
      // Shift acknowledgement is stored separately from operational records, in the existing SQLite database.
      // It is per authenticated operator, shift and exact important-record version set.
      const shiftAwareness49=(session=authorized())=>{
        const crypto=require('node:crypto');
        const shift=require('../src/shift.js').at(new Date());
        const scope=visible(store.read(),session);
        const rows=(scope.items||[]).filter(x=>!x.deleted_at&&x.status!=='Resolvido');
        const important=rows.filter(x=>['Urgente','Alta','AtenÃ§Ã£o'].includes(x.priority)||x.deadline&&Date.parse(x.deadline)<Date.now())
          .sort((a,b)=>String(a.protocol||a.id).localeCompare(String(b.protocol||b.id)))
          .map(x=>({id:x.id,protocol:x.protocol||String(x.id),title:x.subject||'OcorrÃªncia',description:x.description||'',priority:x.priority||'Normal',deadline:x.deadline||null,condo:x.condo||'',version:x.updated_at||x.created_at||'',status:x.status}));
        const version=crypto.createHash('sha256').update(JSON.stringify(important.map(x=>[x.id,x.version,x.priority,x.deadline,x.status]))).digest('hex');
        store.db.exec('CREATE TABLE IF NOT EXISTS shift_awareness49 (user_id TEXT NOT NULL,shift_id TEXT NOT NULL,version TEXT NOT NULL,ack_at TEXT NOT NULL,important_count INTEGER NOT NULL,PRIMARY KEY(user_id,shift_id,version))');
        store.db.exec('CREATE TABLE IF NOT EXISTS shift_ack51 (user_id TEXT NOT NULL,shift_id TEXT NOT NULL,snapshot_version TEXT NOT NULL,record_id TEXT NOT NULL,record_version TEXT NOT NULL,ack_at TEXT NOT NULL,remote_at TEXT,PRIMARY KEY(user_id,shift_id,snapshot_version,record_id,record_version))');
        const uid=String(session.userId||session.username||'');
        if(!uid)throw Error('Identidade de operador indisponÃ­vel.');
        const ack=store.db.prepare('SELECT record_id,record_version,ack_at,remote_at FROM shift_ack51 WHERE user_id=? AND shift_id=? AND snapshot_version=?').all(uid,shift.id,version);
        const acknowledged=important.filter(x=>ack.some(a=>a.record_id===String(x.id)&&a.record_version===String(x.version)));
        const prior=store.db.prepare('SELECT ack_at FROM shift_awareness49 WHERE user_id=? AND shift_id=? AND version=?').get(uid,shift.id,version);
        return {shiftId:shift.id,shiftLabel:shift.type+' - '+shift.date,version,items:important,openCount:rows.length,accepted:!!prior&&acknowledged.length===important.length,acceptedAt:prior?.ack_at||null,acknowledgedIds:acknowledged.map(x=>String(x.id)),remotePending:ack.filter(a=>!a.remote_at).length};
      };
      const pushAck51=async(session)=>{
        if(session.mode!=='online'||!sync?.authenticated||!sync.client||!sync.workspace())return false;
        const uid=String(session.userId||'');
        if(!/^[0-9a-f-]{36}$/i.test(uid))return false;
        const rows=store.db.prepare('SELECT user_id,shift_id,snapshot_version,record_id,record_version,ack_at FROM shift_ack51 WHERE user_id=? AND remote_at IS NULL ORDER BY ack_at LIMIT 100').all(uid);
        if(!rows.length)return true;
        const workspace=sync.workspace();
        const payload=rows.map(x=>({workspace_id:workspace,user_id:uid,shift_id:x.shift_id,snapshot_version:x.snapshot_version,record_id:x.record_id,record_version:x.record_version,acknowledged_at:x.ack_at}));
        const {error}=await sync.client.from('mop_shift_ack51').upsert(payload,{onConflict:'workspace_id,user_id,shift_id,snapshot_version,record_id,record_version',ignoreDuplicates:true});
        if(error)throw Error('SincronizaÃ§Ã£o de ciÃªncia indisponÃ­vel: '+error.message);
        const mark=store.db.prepare('UPDATE shift_ack51 SET remote_at=? WHERE user_id=? AND shift_id=? AND snapshot_version=? AND record_id=? AND record_version=?');
        const now=new Date().toISOString();for(const x of rows)mark.run(now,x.user_id,x.shift_id,x.snapshot_version,x.record_id,x.record_version);
        return true;
      };
      const refreshHandover108=session=>require('./startup-refresh107.cjs').refresh(sync,session,authorized);
      ipcMain.handle('mop:startup108',async(event,action,input={})=>{
        try{
          trusted(event);
          const session=authorized(),gate=require('./startup-gate108.cjs');
          if(action==='history')return {ok:true,value:gate.history(store,session)};
          if(!['snapshot','receive'].includes(action))throw Error('Ação inválida.');
          const fresh=await refreshHandover108(session);
          if(action==='snapshot'){
            const value=gate.snapshot(store,session);
            return {ok:true,value:{...value,centralVerified:fresh.verified,syncStatus:fresh.status,syncReason:fresh.reason}};
          }
          const result=gate.receive(store,session,input);
          readVersion=JSON.stringify(store.read());
          if(sync){sync.emit(true);void Promise.resolve(sync.kick()).catch(e=>console.error('Recebimento pendente de sincronização:',e.message))}
          return {ok:true,value:result};
        }catch(error){return {ok:false,error:privacy.clean(error.message)}}
      });
      ipcMain.handle('mop:awareness49',async(event,action,input={})=>{
        try{
          trusted(event);
          const session=authorized();
          if(!['snapshot','accept','history'].includes(action))throw Error('AÃ§Ã£o invÃ¡lida.');
          if(action==='history'){
            if(!['supervisor','admin'].includes(session.role))throw Error('HistÃ³rico restrito Ã  supervisÃ£o.');
            const local=store.db.prepare('SELECT user_id,shift_id,snapshot_version,record_id,record_version,ack_at,remote_at FROM shift_ack51 ORDER BY ack_at DESC LIMIT 200').all();
            let remote=[];if(session.mode==='online'&&sync?.client&&sync.workspace()){const result=await sync.client.from('mop_shift_ack51').select('user_id,shift_id,snapshot_version,record_id,record_version,acknowledged_at').eq('workspace_id',sync.workspace()).order('acknowledged_at',{ascending:false}).limit(200);if(!result.error)remote=result.data||[];}
            return {ok:true,value:{local,remote}};
          }
          if(action==='snapshot'){
            try{await pushAck51(session)}catch(error){console.warn('[MOP ack51] Pending sync:',error.message)}
            return {ok:true,value:shiftAwareness49(session)};
          }
          if(session.role==='viewer')throw Error('Perfil de consulta nÃ£o realiza aceite operacional.');
          const current=shiftAwareness49(session);
          if(input?.shiftId!==current.shiftId||input?.version!==current.version)throw Error('OcorrÃªncias ou turno atualizados. Revise novamente antes do aceite.');
          const ids=input?.recordIds;
          if(!Array.isArray(ids)||ids.length!==current.items.length||new Set(ids.map(String)).size!==current.items.length||current.items.some(x=>!ids.map(String).includes(String(x.id))))throw Error('Ã‰ necessÃ¡rio confirmar individualmente todas as ocorrÃªncias.');
          const uid=String(session.userId||session.username),now=new Date().toISOString();
          const insert=store.db.prepare('INSERT OR IGNORE INTO shift_ack51(user_id,shift_id,snapshot_version,record_id,record_version,ack_at) VALUES(?,?,?,?,?,?)');
          const aggregate=store.db.prepare('INSERT OR IGNORE INTO shift_awareness49(user_id,shift_id,version,ack_at,important_count) VALUES(?,?,?,?,?)');
          // DatabaseSync (node:sqlite) does not expose db.transaction(); use an explicit atomic transaction.
          store.db.exec('BEGIN IMMEDIATE');
          try {
            for(const x of current.items)insert.run(uid,current.shiftId,current.version,String(x.id),String(x.version),now);
            aggregate.run(uid,current.shiftId,current.version,now,current.items.length);
            store.db.exec('COMMIT');
          } catch(error) {
            try { store.db.exec('ROLLBACK'); } catch(rollbackError) { console.error('[MOP ack51] Rollback failed:',rollbackError.message); }
            throw error;
          }
          try{await pushAck51(session)}catch(error){console.warn('[MOP ack51] Pending sync:',error.message)}
          return {ok:true,value:shiftAwareness49(session)};
        }catch(e){console.error('[MOP ack51]',e.message);return {ok:false,error:privacy.clean(e.message)}}
      });
      const snapshot36=()=>require('./handover107.cjs').snapshot(store,authorized());
      ipcMain.handle('mop:handover36',async(event,action,input={})=>{
        try{
          trusted(event);const session=authorized();
          if(action==='snapshot')return {ok:true,value:snapshot36()};
          if(!['deliver','receive','assignPending'].includes(action))throw Error('Comando inválido.');
          if(!require('./startup-gate108.cjs').snapshot(store,session).accepted)throw Error('Confirme a ciência das pendências importantes antes da passagem de turno.');
          const result=require('./handover107.cjs').checkout(store,session,action,input);
          readVersion=JSON.stringify(store.read());
          let syncState='local';
          if(sync){try{sync.emit(true);if(session.mode==='online')await sync.kick();else void Promise.resolve(sync.kick()).catch(()=>{});syncState=sync.status().state}catch(error){syncState='offline';console.error('Passagem salva localmente; sincronização pendente:',error.message)}}
          return {ok:true,value:{...result,syncState}};
        }catch(error){return {ok:false,error:privacy.clean(error.message)}}
      });
       ipcMain.handle('mop:occurrence103',async(event,operation,input)=>{try{trusted(event);const session=authorized();if(!require('./startup-gate108.cjs').snapshot(store,session).accepted&&operation!=='list')throw Error('Confirme a ciência do turno antes de alterar ocorrências.');const value=await require('./occurrence103.cjs').action(sync,store,session,operation,input);authorized();if(operation!=='list'){sync.emit(true);if(operation==='status')void sync.kick().catch(e=>console.error('Sincronização de status pendente:',e.message))}return {ok:true,value};}catch(error){return {ok:false,error:privacy.clean(error.message)}}});
       ipcMain.handle('mop:checklist68',async(event,action,input)=>{
         try{trusted(event);const session=authorized();const local=require('./checklist68.cjs');local.setup(store.db);
           const shared=require('./shared-ops93.cjs');let value;
           if(shared.active(sync,session)){value=await shared.checklist(sync,session,action,input);if(action!=='list')sync.emit(true)}
           else{if(sync?.local?.bound())throw Error('Rotinas centrais indisponíveis. Reconecte ao Supabase antes de consultar ou alterar rotinas.');value=local.action(store.db,session,action,input)}
           authorized();return {ok:true,value};
         }catch(error){return {ok:false,error:privacy.clean(error.message)}}
       });
       ipcMain.handle('mop:schedule68',async(event,action,input)=>{
         try{trusted(event);const session=authorized();const local=require('./schedule68.cjs');local.setup(store.db);
           const central=require('./schedule-central81.cjs'),shared=require('./shared-ops93.cjs');let value;
           if(shared.active(sync,session)){
             if(['save','batch'].includes(action)){value=await central.action(sync,store,session,action,input);sync.emit(true)}
             else if(action==='load'){value=await central.action(sync,store,session,action,input);value={...value,requests:await shared.requests(sync,session,'load',input)}}
             else if(['pending','request','decide','peers','inbox','respond'].includes(action)){value=await shared.requests(sync,session,action,input);if(['request','decide','respond'].includes(action))sync.emit(true)}
             else throw Error('Operação de escala inválida.');
           }else{
             if(sync?.local?.bound())throw Error('Escala central indisponível. Reconecte ao Supabase para consultar e alterar escalas ou solicitações; nenhum dado local foi modificado.');
             value=local.action(store.db,session,action,input);
           }
           authorized();return {ok:true,value};
         }catch(error){return {ok:false,error:privacy.clean(error.message)}}
       });
      ipcMain.handle('mop:schedule-export76',async(event,input)=>{let preview;try{trusted(event);const session=authorized();const month=String(input?.month||'');const format=String(input?.format||'');if(!['pdf','xlsx'].includes(format)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('ExportaÃ§Ã£o invÃ¡lida.');const manager=['admin','supervisor'].includes(session.role);const employeeId=manager&&input?.employeeId?String(input.employeeId):String(session.userId);if(!employeeId||employeeId.length>160)throw Error('Colaborador invÃ¡lido.');const schedule=require('./schedule68.cjs');schedule.setup(store.db);const central=require('./schedule-central81.cjs'),shared=require('./shared-ops93.cjs');const result=shared.active(sync,session)?await central.action(sync,store,session,'load',{employeeId,month}):(()=>{if(sync?.local?.bound())throw Error('Escala central indisponível. Reconecte antes de exportar.');return schedule.action(store.db,session,'load',{employeeId,month})})();const name=employeeId===String(session.userId)?String(session.display_name||session.username||'Colaborador'):String(input.employeeName||employeeId);const exportModule=require('./schedule-export76.cjs');const payload={month,rows:result.rows,employeeName:name,anchorDate:String(input?.anchorDate||month+'-01')};let data;if(format==='xlsx')data=await exportModule.xlsx(payload);else{preview=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});preview.webContents.setWindowOpenHandler(()=>({action:'deny'}));await preview.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(exportModule.html(payload)));data=await preview.webContents.printToPDF({printBackground:true,pageSize:'A4',margins:{top:.25,bottom:.25,left:.25,right:.25},displayHeaderFooter:false});}const filename='MOP-Escala-'+month+'-'+employeeId.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,32)+'.'+format;const save=await dialog.showSaveDialog(win,{title:'Exportar escala individual',defaultPath:path.join(app.getPath('documents'),filename),filters:[{name:format.toUpperCase(),extensions:[format]}]});authorized();if(save.canceled)return {ok:true,value:false};fs.writeFileSync(save.filePath,data);return {ok:true,value:true};}catch(e){return {ok:false,error:privacy.clean(e.message)}}finally{if(preview&&!preview.isDestroyed())preview.destroy()}});

      ipcMain.handle('mop-next:window-command',(event,action)=>{trusted(event);if(!win||win.isDestroyed())throw Error('Janela indisponÃ­vel');if(action==='close'){setImmediate(()=>{if(win&&!win.isDestroyed())win.close()});return {closed:true}}if(action==='minimize')win.minimize();else if(action==='maximize'){win.isMaximized()?win.unmaximize():win.maximize()}else if(action!=='status')throw Error('AÃ§Ã£o de janela invÃ¡lida');return {maximized:win.isMaximized(),minimized:win.isMinimized()};});
      
      win = new BrowserWindow({width:1440,height:900,minWidth:360,minHeight:620,frame:false,backgroundColor:'#071322',title:'MOP â€” desenvolvido por NOXUZ',icon:path.join(__dirname,'../assets/icon.ico'),show:false,webPreferences:{preload:path.join(__dirname,'preload-next43.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,spellcheck:true}});
      Menu.setApplicationMenu(null);
      win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
      win.webContents.on('will-navigate',(event,url)=>{if(url!==indexURL)event.preventDefault();});
      win.webContents.on('did-start-navigation',(_event,_url,_inPlace,isMainFrame)=>{if(isMainFrame&&access?.session)void access.lock();});
      win.webContents.on('render-process-gone',()=>{if(access)void access.lock();});
      win.webContents.on('will-attach-webview',event=>event.preventDefault());
      win.webContents.session.setSpellCheckerEnabled(true);
      win.webContents.session.setSpellCheckerLanguages(['pt-BR']);
      win.webContents.on('context-menu',(_event,params)=>{if(!params.isEditable)return;const menu=new Menu();for(const suggestion of params.dictionarySuggestions||[])menu.append(new MenuItem({label:suggestion,click:()=>win.webContents.replaceMisspelling(suggestion)}));if(params.misspelledWord){if(menu.items.length)menu.append(new MenuItem({type:'separator'}));menu.append(new MenuItem({label:'Adicionar ao dicionÃ¡rio',click:()=>win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)}));}if(menu.items.length)menu.popup({window:win});});
      win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
      win.webContents.session.setPermissionCheckHandler(()=>false);
      win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{const dictionary=/^https:\/\/(?:redirector\.gvt1\.com|dl\.google\.com)\/(?:dl\/)?edgedl\/chrome\/dict\/[a-z0-9-]+\.bdic(?:\?.*)?$/i.test(details.url);callback({cancel:!dictionary});});
      let startupShown=false;const showStartup=()=>{if(startupShown||!win||win.isDestroyed())return;startupShown=true;win.show();windowShown()};win.once('ready-to-show',showStartup);win.webContents.once('did-finish-load',showStartup);setTimeout(showStartup,2500);
      powerMonitor.on('resume',()=>{if(win&&!win.isDestroyed())win.webContents.send('mop:resume');});
      powerMonitor.on('lock-screen',()=>{if(access)void access.lock();});
      powerMonitor.on('suspend',()=>{if(access)void access.lock();});
      win.loadFile(index);
      const reminders97=require('./reminder-window97.cjs').create({
        BrowserWindow,ipcMain,
        getContext:()=>{try{if(!access?.session||!store)return null;return {session:access.require(),store}}catch{return null}},
        getTasks:async session=>{
          const shared=require('./shared-ops93.cjs');
          if(shared.active(sync,session))return shared.checklist(sync,session,'list');
          if(sync?.local?.bound())return {tasks:[],runs:[]};
          const local=require('./checklist68.cjs');local.setup(store.db);return local.action(store.db,session,'list');
        },
        complete:async(session,id)=>{
          const shared=require('./shared-ops93.cjs');
          if(shared.active(sync,session)){await shared.checklist(sync,session,'complete',{id});sync.emit(true);}
          else if(sync?.local?.bound())throw Error('Central indisponível. Reconecte para concluir a rotina.');
          else{const local=require('./checklist68.cjs');local.setup(store.db);local.action(store.db,session,'complete',{id});}
        }
      });
      ipcMain.handle('mop:reminder97-test',event=>response(event,()=>reminders97.showTest()));
      powerMonitor.on('resume',()=>void reminders97.poll());
      app.on('before-quit',()=>reminders97.stop());
      alertTimer=setInterval(()=>{
        if(!access?.session||!store||!Notification.isSupported())return;
        try{
          const session=access.require(),alerts=operations.alerts(visible(store.read(),session));
          const signature=alerts.map(a=>[a.item.protocol,a.level,a.escalated,a.item.updated_at].join(':')).join('|');
          const key='alerts:'+session.userId;
          if(!signature||signature===sync.local.setting(key))return;
          sync.local.set(key,signature);
          const overdue=alerts.filter(a=>a.level==='late').length;
          const notification=new Notification({icon:path.join(__dirname,'../assets/mop-icon-1024.png'),title:'MOP Â· AtenÃ§Ã£o Ã s pendÃªncias',body:alerts.length+' alerta(s), '+overdue+' prazo(s) vencido(s). Abra o painel de alertas para conferir.'});
          notification.on('click',()=>{if(win&&!win.isDestroyed()){win.show();win.focus();win.webContents.send('mop:alert');}});notification.show();
        }catch{}
      },30000);alertTimer.unref();
    } catch(e) {
      dialog.showErrorBox('MOP â€” nÃ£o foi possÃ­vel iniciar',e.message+'\nOs dados existentes foram preservados. Consulte LEIA-ME.md para recuperaÃ§Ã£o.');
      app.quit();
    }
  });
  app.on('window-all-closed',()=>app.quit());
  app.on('will-quit',()=>{clearInterval(alertTimer);if(access)access.close();if(sync)sync.close();if(store)store.close();});
}
