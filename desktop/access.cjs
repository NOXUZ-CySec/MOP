'use strict';
const {randomBytes,scrypt,timingSafeEqual}=require('node:crypto');
const {promisify}=require('node:util');
const derive=promisify(scrypt);
const OFFLINE_VALIDITY=7*24*60*60*1000;
const failure=(message,code)=>Object.assign(Error(message),{code});
class Access {
  constructor(sync,{safeStorage,onLock=()=>{},now=Date.now}={}){
    this.sync=sync;this.safeStorage=safeStorage;this.onLock=onLock;this.now=now;
    this.session=null;this.epoch=0;this.busy=false;this.failures=0;this.retryAt=0;this.expiryTimer=null;
  }
  status(){return {authenticated:!!this.session,mode:this.session?.mode||null,firstConnection:!this.sync.local.bound(),email:this.session?.email,userId:this.session?.userId,role:this.session?.role,condos:this.session?.condos};}
  require(){
    if(this.session&&this.now()>=this.session.expiresAt)this.lock();
    if(!this.session)throw failure('Entre com seu e-mail e senha para acessar o MOP.','LOGIN_REQUIRED');
    return this.session;
  }
  readGrant(){
    try{
      if(!this.safeStorage?.isEncryptionAvailable())return null;
      const value=this.sync.local.setting('access:offline');
      return value?JSON.parse(this.safeStorage.decryptString(Buffer.from(value,'base64'))):null;
    }catch{return null;}
  }
  async saveGrant(email,password){
    const expiresAt=this.now()+OFFLINE_VALIDITY;
    if(!this.safeStorage?.isEncryptionAvailable())return expiresAt;
    const salt=randomBytes(32).toString('hex');
    const verifier=(await derive(password,salt,64)).toString('hex');
    const grant={...require('./operations.cjs').policy(this.sync.membership),email,userId:this.sync.userId,binding:this.sync.local.bound(),salt,verifier,validatedAt:this.now(),expiresAt};
    this.sync.local.set('access:offline',this.safeStorage.encryptString(JSON.stringify(grant)).toString('base64'));
    return expiresAt;
  }
  async offline(email,password){
    const grant=this.readGrant();
    if(!grant||grant.email!==email||grant.binding!==this.sync.local.bound()||!grant.binding||this.now()<grant.validatedAt||this.now()>=grant.expiresAt)
      throw failure('Sem conexão. Faça um login online autorizado neste computador antes de usar o acesso offline (válido por até 7 dias).','OFFLINE_UNAVAILABLE');
    const expected=Buffer.from(grant.verifier,'hex');
    const actual=await derive(password,grant.salt,64);
    if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw failure('E-mail ou senha incorretos.','LOGIN_REJECTED');
    return {...require('./operations.cjs').policy(grant),email,userId:grant.userId,mode:'offline',expiresAt:grant.expiresAt};
  }
  async login(input={}){
    if(this.busy)throw failure('Aguarde a tentativa de login em andamento.','LOGIN_BUSY');
    if(this.now()<this.retryAt)throw failure('Muitas tentativas. Aguarde 30 segundos e tente novamente.','LOGIN_RATE_LIMIT');
    if(this.session)throw failure('Encerre a sessão atual antes de trocar de usuário.','ALREADY_LOGGED_IN');
    const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
    const password=typeof input.password==='string'?input.password:'';
    if(!email.includes('@')||email.length>254||!password||password.length>1024)throw failure('Informe um e-mail e uma senha válidos.','LOGIN_REJECTED');
    this.busy=true;const epoch=this.epoch;
    try{
      await this.stopping;
      let session;
      try{
        await this.sync.connect({...this.sync.config,email,password,uploadExisting:input.uploadExisting===true},{deferSync:true});
        if(!this.sync.authenticated||!this.sync.userId)throw failure('Não foi possível validar sua autorização.','AUTH_DENIED');
        const expiresAt=await this.saveGrant(email,password);
        session={...require('./operations.cjs').policy(this.sync.membership),email,userId:this.sync.userId,mode:'online',expiresAt};
      }catch(error){
        if(['AUTH_DENIED','42501','invalid_credentials','user_banned','email_not_confirmed'].includes(error.code))this.clearGrant();
        if(error.code!=='NETWORK_UNAVAILABLE')throw error;
        session=await this.offline(email,password);
      }
      if(epoch!==this.epoch)throw failure('Login interrompido. Entre novamente.','LOGIN_CANCELLED');
      this.session=session;this.failures=0;this.retryAt=0;
      clearTimeout(this.expiryTimer);this.expiryTimer=setTimeout(()=>this.lock(),Math.max(1,session.expiresAt-this.now()));this.expiryTimer.unref?.();
      if(session.mode==='online'){this.sync.subscribe();this.sync.kick();}
      else this.sync.start();
      return this.status();
    }catch(error){
      this.failures++;if(this.failures>=5){this.failures=0;this.retryAt=this.now()+30000;}
      throw error;
    }finally{this.busy=false;}
  }
  clearGrant(){this.sync.local.db.prepare("DELETE FROM sync_settings WHERE key='access:offline'").run();}
  lock(){
    this.epoch++;this.session=null;clearTimeout(this.expiryTimer);
    this.onLock();
    // Retain the encrypted server session for reconnecting after a new password
    // check, but never let a saved server token unlock the application by itself.
    this.stopping=this.sync.stopClient();return this.stopping;
  }
  revoke(){this.clearGrant();return this.lock();}
  close(){clearTimeout(this.expiryTimer);this.session=null;this.epoch++;}
}
module.exports={Access,OFFLINE_VALIDITY};
