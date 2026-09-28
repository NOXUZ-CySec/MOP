'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Access,OFFLINE_VALIDITY}=require('../desktop/access.cjs');
const {randomBytes,createCipheriv,createDecipheriv}=require('node:crypto');
function fixture(){
  const data=new Map(),key=randomBytes(32);let now=Date.now(),network=true,allowed=true,locks=0;
  const safeStorage={isEncryptionAvailable:()=>true,
    encryptString:text=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const body=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]);},
    decryptString:b=>{const d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8');}
  };
  const sync={config:{url:'https://test.supabase.co',key:'sb_publishable_test'},
    local:{setting:k=>data.get(k),set:(k,v)=>data.set(k,v),bound:()=>data.get('binding'),db:{prepare:()=>({run:()=>data.delete('access:offline')})}},
    connect:async input=>{if(!network)throw Object.assign(Error('Sem rede'),{code:'NETWORK_UNAVAILABLE'});if(input.password!=='correct-password')throw Object.assign(Error('Senha incorreta'),{code:'LOGIN_REJECTED'});if(!allowed)throw Object.assign(Error('Sem permissão'),{code:'AUTH_DENIED'});sync.authenticated=true;sync.userId='authorized-user';data.set('binding','https://test.supabase.co|workspace');},
    subscribe:()=>{},kick:()=>{},start:()=>{},stopClient:async()=>{}
  };
  const options={safeStorage,onLock:()=>{locks++;},now:()=>now};
  const access=new Access(sync,options);
  return {access,sync,data,options,network:v=>{network=v;},allowed:v=>{allowed=v;},advance:ms=>{now+=ms;},locks:()=>locks};
}
const credentials={email:'operator@example.com',password:'correct-password',uploadExisting:true};
test('login obrigatório, senha errada rejeitada e sessão persistida não desbloqueia nova abertura',async t=>{
  const f=fixture();t.after(()=>f.access.close());assert.throws(()=>f.access.require(),/Entre/);
  await assert.rejects(f.access.login({...credentials,password:'incorrect'}),/Senha incorreta/);assert.throws(()=>f.access.require());
  await f.access.login(credentials);assert.equal(f.access.require().mode,'online');
  assert.ok(!JSON.stringify([...f.data]).includes(credentials.password));
  const second=new Access(f.sync,f.options);t.after(()=>second.close());assert.throws(()=>second.require(),/Entre/);
  await f.access.lock();assert.throws(()=>f.access.require(),/Entre/);assert.equal(f.locks(),1);
});
test('offline exige login online anterior, senha correta, mesma central e autorização dentro do prazo',async t=>{
  const f=fixture();t.after(()=>f.access.close());f.network(false);await assert.rejects(f.access.login(credentials),/login online/);
  f.network(true);await f.access.login(credentials);await f.access.lock();f.network(false);
  await assert.rejects(f.access.login({...credentials,password:'incorrect'}),/incorretos/);
  await f.access.login(credentials);assert.equal(f.access.require().mode,'offline');await f.access.lock();
  f.advance(OFFLINE_VALIDITY+1);await assert.rejects(f.access.login(credentials),/login online/);assert.throws(()=>f.access.require());
});
test('negação online não usa credencial offline; revogação apaga autorização local',async t=>{
  const f=fixture();t.after(()=>f.access.close());await f.access.login(credentials);await f.access.lock();
  f.allowed(false);await assert.rejects(f.access.login(credentials),/permissão/);assert.equal(f.data.has('access:offline'),false);
  f.network(false);await assert.rejects(f.access.login(credentials),/login online/);
});
test('bloqueio durante login impede resposta tardia de abrir dados; limite de tentativas',async t=>{
  const f=fixture();t.after(()=>f.access.close());const original=f.sync.connect;let resume;
  f.sync.connect=async input=>{await new Promise(resolve=>{resume=resolve;});await original(input);};
  const pending=f.access.login(credentials);await new Promise(resolve=>setImmediate(resolve));await f.access.lock();resume();
  await assert.rejects(pending,/interrompido/);assert.throws(()=>f.access.require());f.sync.connect=original;
  for(let i=0;i<4;i++)await assert.rejects(f.access.login({...credentials,password:'incorrect'}));
  await assert.rejects(f.access.login(credentials),/30 segundos/);f.advance(30001);await f.access.login(credentials);assert.equal(f.access.require().mode,'online');
});
test('credencial offline danificada ou criptografia indisponível mantém o bloqueio',async t=>{
  const f=fixture();t.after(()=>f.access.close());await f.access.login(credentials);await f.access.lock();f.network(false);
  const b=Buffer.from(f.data.get('access:offline'),'base64');b[30]^=255;f.data.set('access:offline',b.toString('base64'));
  await assert.rejects(f.access.login(credentials),/login online/);assert.throws(()=>f.access.require());
  f.options.safeStorage.isEncryptionAvailable=()=>false;await assert.rejects(f.access.login(credentials),/login online/);
});
test('mudança de senha confirmada pelo servidor invalida a credencial offline antiga',async t=>{
  const f=fixture();t.after(()=>f.access.close());await f.access.login(credentials);await f.access.lock();
  f.sync.connect=async()=>{throw Object.assign(Error('Senha não aceita pelo servidor'),{code:'invalid_credentials'});};
  await assert.rejects(f.access.login(credentials),/servidor/);assert.equal(f.data.has('access:offline'),false);assert.throws(()=>f.access.require());
});
