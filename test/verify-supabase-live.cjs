'use strict';
// Read-only hosted-project diagnostic. Never signs in, refreshes tokens, or sends
// business records. Run with Electron so Windows can decrypt the saved session.
const {app,safeStorage}=require('electron');
const {DatabaseSync}=require('node:sqlite');
const path=require('node:path'),fs=require('node:fs');
const {createClient}=require('@supabase/supabase-js');
const defaults=require('../desktop/supabase-config.cjs');
const {configuration}=require('../desktop/sync-engine.cjs');
const profile=path.join(app.getPath('appData'),'MOP','dados','mop.sqlite');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,o)=>fetch(url,{...o,signal:AbortSignal.timeout(12000)})}};
app.whenReady().then(async()=>{
  let db,client;
  const report={checkedAt:new Date().toISOString(),readOnly:true};
  try{
    let get=()=>undefined;
    if(fs.existsSync(profile)){
      db=new DatabaseSync(profile,{readOnly:true});
      if(db.prepare("SELECT name FROM sqlite_master WHERE name='sync_settings'").get()){
        get=key=>db.prepare('SELECT value FROM sync_settings WHERE key=?').get(key)?.value;
        report.local={bound:!!get('binding'),lastSync:get('lastSync')||null,pending:db.prepare('SELECT count(*) n FROM sync_pending').get().n,conflicts:db.prepare('SELECT count(*) n FROM sync_conflicts').get().n};
      }
    }
    const config=configuration(JSON.parse(get('config')||JSON.stringify(defaults)));report.project=config.url;
    const health=await fetch(config.url+'/auth/v1/settings',{headers:{apikey:config.key},signal:AbortSignal.timeout(12000)});
    report.authService={status:health.status,reachable:health.ok};
    const anon=createClient(config.url,config.key,options);
    report.anonymous=await Promise.all(['mop_members','mop_records','mop_workspaces','mop_operations'].map(async table=>{const r=await anon.from(table).select('*').limit(0);return {table,status:r.status,code:r.error?.code,accessDenied:r.error?.code==='42501'};}));
    const ref=new URL(config.url).hostname.split('.')[0];
    const encrypted=get('auth:sb-'+ref+'-auth-token');
    if(!encrypted){report.authenticated={verified:false,reason:'NO_SAVED_SESSION'};return;}
    if(!safeStorage.isEncryptionAvailable()){report.authenticated={verified:false,reason:'SESSION_ENCRYPTION_UNAVAILABLE'};return;}
    const session=JSON.parse(safeStorage.decryptString(Buffer.from(encrypted,'base64')));
    const token=session.access_token;
    if(typeof token!=='string'){report.authenticated={verified:false,reason:'SESSION_FORMAT_INVALID'};return;}
    client=createClient(config.url,config.key,{...options,global:{...options.global,headers:{Authorization:'Bearer '+token}}});
    const auth=await client.auth.getUser(token);
    if(auth.error){report.authenticated={verified:false,status:auth.error.status,reason:auth.error.code||'SESSION_INVALID'};return;}
    report.authenticated={verified:true,userId:auth.data.user.id};
    const memberships=await client.from('mop_members').select('workspace_id').eq('user_id',auth.data.user.id);
    const workspace=get('binding')?.split('|')[1];
    const allowed=!!memberships.data?.some(r=>r.workspace_id===workspace);
    report.membership={verified:allowed,status:memberships.status,count:memberships.data?.length||0};
    if(!allowed)return;
    const records=await client.from('mop_records').select('id',{count:'exact',head:true}).eq('workspace_id',workspace);
    report.database={readVerified:!records.error,status:records.status,remoteRecords:records.count};
    // A deliberately invalid base version must be rejected before any INSERT.
    const rpc=await client.rpc('mop_push',{p_workspace:workspace,p_op:'11111111-1111-4111-8111-111111111111',p_id:'11111111-1111-4111-8111-111111111111',p_kind:'items',p_base:-1,p_payload:{}});
    report.rpc={reachable:rpc.error?.code==='P0001'&&rpc.error.message.startsWith('Alteração inválida'),status:rpc.status,code:rpc.error?.code};
    await client.realtime.setAuth(token);
    report.realtime=await new Promise(resolve=>{
      const timer=setTimeout(()=>resolve({subscribed:false,status:'TIMEOUT'}),12000);
      client.channel('mop-connection-check-'+Date.now()).on('postgres_changes',{event:'*',schema:'public',table:'mop_records',filter:'workspace_id=eq.'+workspace},()=>{}).subscribe(status=>{
        if(['SUBSCRIBED','CHANNEL_ERROR','TIMED_OUT'].includes(status)){clearTimeout(timer);resolve({subscribed:status==='SUBSCRIBED',status});}
      });
    });
    report.writesTested=false;report.realtimeDeliveryTested=false;
  }catch(error){report.error=error.message;process.exitCode=1;}
  finally{
    if(client)await client.removeAllChannels();if(db)db.close();
    console.log(JSON.stringify(report,null,2));app.exit(process.exitCode||0);
  }
});
