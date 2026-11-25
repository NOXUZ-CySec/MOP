'use strict';
const {createClient}=require('@supabase/supabase-js');
const {SyncStore}=require('./sync-store.cjs');
const defaults=require('./supabase-config.cjs');
function connectionUnavailable(error){return error?.name==='AuthRetryableFetchError'||error?.status===0||error?.status>=500||/fetch failed|failed to fetch|networkerror|network request failed|timed?\s*out|ECONN|ENOTFOUND/i.test(error?.message||'');}
function connectionFailure(error,message){return Object.assign(Error(message),{code:connectionUnavailable(error)?'NETWORK_UNAVAILABLE':error?.code||'LOGIN_REJECTED'});}
function configuration(input){
  const url=new URL(input.url);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash)throw Error('Use a URL HTTPS do projeto Supabase, sem caminhos adicionais.');
  const key=String(input.key||'').trim();
  let anon=false;
  try{anon=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{}
  if(!key.startsWith('sb_publishable_')&&!anon)throw Error('Use somente a chave publicável ou anon. Chaves secretas não são aceitas.');
  return {url:url.origin,key};
}
class SyncEngine {
  constructor(store,{safeStorage,notify=()=>{},clientFactory=createClient}={}){
    this.local=new SyncStore(store);this.safeStorage=safeStorage;this.notify=notify;this.clientFactory=clientFactory;
    this.state='local';this.message='Trabalhando no banco local.';this.running=null;this.timer=null;this.channel=null;this.client=null;this.closed=false;this.authenticated=false;
    this.config=JSON.parse(this.local.setting('config')||JSON.stringify(defaults));
  }
  status(){return {...this.local.status(),state:this.state,message:require('../src/privacy.js').clean(this.message),authenticated:this.authenticated,display_name:require('../src/privacy.js').label(this.membership?.display_name,this.userId),url:this.config.url,key:this.config.key,remembered:!!this.safeStorage?.isEncryptionAvailable()};}
  emit(dataChanged=false){this.notify({...this.status(),dataChanged});}
  makeClient(config){
    const encrypted=!!this.safeStorage?.isEncryptionAvailable();
    const storage={
      getItem:key=>{const raw=this.local.setting('auth:'+key);return raw?this.safeStorage.decryptString(Buffer.from(raw,'base64')):null;},
      setItem:(key,value)=>this.local.set('auth:'+key,this.safeStorage.encryptString(value).toString('base64')),
      removeItem:key=>this.local.db.prepare('DELETE FROM sync_settings WHERE key=?').run('auth:'+key)
    };
    return this.clientFactory(config.url,config.key,{
      auth:{persistSession:encrypted,autoRefreshToken:true,detectSessionInUrl:false,...(encrypted?{storage}:{})},
      global:{fetch:(url,options={})=>fetch(url,{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000)})}
    });
  }
  async start(){
    if(this.mayRun?.()===false)return;
    if(!this.local.bound())return;
    try{
      configuration(this.config);
      if(this.local.bound()!==this.config.url+'|'+this.workspace())throw Error('A configuração não corresponde à central vinculada.');
      this.client=this.makeClient(this.config);await this.activate();
    }
    catch(e){this.state='offline';this.message='Sem conexão com a central. Os dados continuam disponíveis localmente. '+e.message;this.emit();this.schedule();}
  }
  async activate(){
    const {data,error}=await this.client.auth.getSession();if(error)throw error;
    if(!data.session){this.authenticated=false;this.state='login';this.message='Entre para sincronizar. Alterações locais continuam salvas.';this.emit();return;}
    this.email=data.session.user.email;this.authenticated=true;
    this.subscribe();await this.kick();
  }
  async resolveLogin(login){
    const config=configuration(this.config);
    const client=this.makeClient(config);
    const {data,error}=await client.rpc('mop_resolve_login',{p_login:String(login||'').trim()});
    try{await client.auth.signOut({scope:'local'});}catch{}
    if(error)throw connectionFailure(error,'Não foi possível localizar o usuário.');
    return typeof data==='string'&&data.includes('@')?data:null;
  }
  async connect(input,{deferSync=false}={}){
    if(this.connecting)throw Error('Aguarde a conexão em andamento.');
    this.connecting=true;
    try{
      const config=configuration(input);
      if(this.local.bound()&&!this.local.bound().startsWith(config.url+'|'))throw Error('Este banco local pertence a outro projeto.');
      const current=this.local.store.read();
      if(!this.local.bound()&&(current.items.length||current.events.length||current.handovers.length)&&!input.uploadExisting)throw Error('Confirme o envio dos registros locais para esta central.');
      await this.stopClient();
      this.client=this.makeClient(config);
      const {data,error}=await this.client.auth.signInWithPassword({email:String(input.email||'').trim(),password:String(input.password||'')});
      if(error){const code=String(error.code||'');if(code==='invalid_credentials')throw connectionFailure(error,'Usuário ou senha incorretos. Confira as credenciais cadastradas no Supabase.');if(code==='email_not_confirmed')throw connectionFailure(error,'Conta sem confirmação de e-mail. Contate o administrador.');if(code==='user_banned')throw connectionFailure(error,'Conta temporariamente bloqueada. Contate o administrador.');throw connectionFailure(error,'Não foi possível autenticar no Supabase. Verifique a conexão e tente novamente.');}
      const membership=await this.client.from('mop_members').select('workspace_id,user_id,username,display_name,role,condos,access_version').eq('user_id',data.user.id);
      if(membership.error)throw connectionFailure(membership.error,'Não foi possível consultar a autorização na central. Confira a conexão e a configuração do projeto.');
      if(membership.data.length!==1)throw Object.assign(Error('O operador não está autorizado nesta central.'),{code:'AUTH_DENIED'});
      this.membership=membership.data[0];
      const workspace=this.membership.workspace_id;
      if(this.local.bound()&&this.local.bound()!==config.url+'|'+workspace)throw Object.assign(Error('Este operador não pertence à central vinculada a este computador.'),{code:'AUTH_DENIED'});
      this.local.prepareProtocols();
      this.local.bind(config.url+'|'+workspace,config);
      this.config=config;
      this.email=data.user.email;this.userId=data.user.id;this.authenticated=true;
      if(!deferSync){this.subscribe();this.kick();}return this.status();
    }catch(e){await this.stopClient();this.client=null;this.authenticated=false;this.state='login';this.message=e.message;this.emit();throw connectionUnavailable(e)?connectionFailure(e,'Sem conexão com a central.'):e;}
    finally{this.connecting=false;}
  }
  workspace(){return this.local.bound()?.split('|')[1];}
  subscribe(){
    if(this.channel||!this.workspace())return;
    this.channel=this.client.channel('mop-'+this.workspace()).on('postgres_changes',{event:'*',schema:'public',table:'mop_records',filter:'workspace_id=eq.'+this.workspace()},()=>this.kick()).on('postgres_changes',{event:'*',schema:'public',table:'mop_schedule_days',filter:'workspace_id=eq.'+this.workspace()},()=>{if(this.mayRun?.()!==false)this.emit(true)}).on('postgres_changes',{event:'*',schema:'public',table:'mop_checklist_tasks',filter:'workspace_id=eq.'+this.workspace()},()=>{if(this.mayRun?.()!==false)this.emit(true)}).on('postgres_changes',{event:'*',schema:'public',table:'mop_checklist_runs',filter:'workspace_id=eq.'+this.workspace()},()=>{if(this.mayRun?.()!==false)this.emit(true)}).on('postgres_changes',{event:'*',schema:'public',table:'mop_schedule_requests',filter:'workspace_id=eq.'+this.workspace()},()=>{if(this.mayRun?.()!==false)this.emit(true)}).subscribe(status=>{
      this.realtime=status==='SUBSCRIBED';
      if(this.realtime)this.kick();
      this.emit();
    });
  }
  schedule(){clearTimeout(this.timer);if(!this.closed)this.timer=setTimeout(()=>this.kick(),15000);this.timer?.unref?.();}
  kick(){
    if(this.closed||this.mayRun?.()===false)return Promise.resolve();
    if(this.running){this.again=true;return this.running;}
    this.running=(async()=>{
      do{this.again=false;await this.cycle();}while(this.again&&!this.closed);
    })().finally(()=>{this.running=null;this.schedule();});
    return this.running;
  }
  async cycle(){
    if(!this.client||!this.local.bound())return;
    this.state='syncing';this.message='Sincronizando alterações…';this.emit();
    let changed=false;
    try{
      const session=await this.client.auth.getSession();
      if(session.error)throw session.error;
      if(!session.data.session){this.authenticated=false;this.state='login';this.message='Entre novamente para sincronizar. Os dados locais estão preservados.';return;}
      this.authenticated=true;this.email=session.data.session.user.email;this.subscribe();
      const membership=await this.client.from('mop_members').select('workspace_id,user_id,username,display_name,role,condos,access_version').eq('user_id',session.data.session.user.id).eq('workspace_id',this.workspace());
      if(membership.error)throw membership.error;
      if(!membership.data.length)throw Object.assign(Error('O operador não tem permissão para acessar esta central.'),{code:'AUTH_DENIED'});
      const updated=membership.data[0];
      if(this.membership&&JSON.stringify(require('./operations.cjs').policy(updated))!==JSON.stringify(require('./operations.cjs').policy(this.membership))){this.membership=updated;this.onAccessDenied?.();throw Object.assign(Error('Permissões alteradas. Entre novamente.'),{code:'AUTH_DENIED'});}
      this.membership=updated;
      const rows=[];let cursor=Number(this.local.setting('cursor')||0);
      for(;;){
        const {data,error}=await this.client.from('mop_records').select('*').eq('workspace_id',this.workspace()).gt('revision',cursor).order('revision').limit(200);
        if(this.closed||this.mayRun?.()===false)return;
        if(error)throw error;if(!data.length)break;
        rows.push(...data);cursor=data[data.length-1].revision;
        if(rows.length>100000)throw Error('Volume de sincronização excedeu o limite desta versão.');
      }
      changed=this.local.apply(rows,cursor);
      const permissions=require('./operations.cjs').policy(this.membership);
      const allowedState=require('./operations.cjs').visible(this.local.store.read(),permissions);
      const allowedSets=Object.fromEntries(Object.entries(allowedState).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,new Set(v.map(x=>x.id))]));
      for(let count=0;count<200;count++){
        const op=this.local.next(row=>permissions.role!=='viewer'&&allowedSets[row.kind]?.has(row.local_id)&&(row.kind!=='templates'||['admin','supervisor'].includes(permissions.role)));if(!op)break;
        const {data,error}=await this.client.rpc('mop_push',{p_workspace:this.workspace(),p_op:op.op,p_id:op.id,p_kind:op.kind,p_base:op.base,p_payload:op.payload});
        if(this.closed||this.mayRun?.()===false)return;
        if(error)throw error;
        this.local.acknowledge(op,data);
        if(data.ok)this.again=true;
      }
      const {pending,conflicts}=this.local.status();
      this.state=conflicts?'conflict':pending?'syncing':'online';
      this.message=conflicts?'Há alterações simultâneas para revisar.':pending?'Enviando alterações pendentes…':'Dados sincronizados'+(this.realtime?' em tempo real.':'. Reconectando notificações; conferência automática a cada 15 segundos.');
      this.local.set('lastSync',new Date().toISOString());
    }catch(e){
      if(e.code==='AUTH_DENIED'||e.code==='42501'||e.status===401||['refresh_token_not_found','refresh_token_already_used','session_not_found','user_banned'].includes(e.code)){
        this.authenticated=false;this.onAccessDenied?.();
      }
      this.state='offline';this.message='Sincronização indisponível. Alterações salvas neste computador. '+(e.message||String(e));
    }finally{if(!this.closed)this.emit(changed);}
  }
  async stopClient(){
    clearTimeout(this.timer);this.closed=true;this.again=false;
    if(this.running)await this.running;
    if(this.channel&&this.client)await this.client.removeChannel(this.channel);
    this.channel=null;this.client?.auth.stopAutoRefresh();this.closed=false;
  }
  async disconnect(){
    await this.stopClient();
    // Local sign-out also works offline; revocation on the server is not required.
    for(const row of this.local.db.prepare("SELECT key FROM sync_settings WHERE key LIKE 'auth:%'").all())this.local.db.prepare('DELETE FROM sync_settings WHERE key=?').run(row.key);
    this.client=null;this.authenticated=false;this.email='';this.state='local';this.message='Sessão encerrada. Alterações serão sincronizadas após entrar novamente.';this.emit();return this.status();
  }
  resolve(id,choice,version){this.local.resolve(id,choice,version);this.emit(true);this.kick();return this.status();}
  close(){this.closed=true;clearTimeout(this.timer);this.client?.auth.stopAutoRefresh();if(this.channel)this.client.removeChannel(this.channel).catch(()=>{});}
}
module.exports={SyncEngine,configuration};
