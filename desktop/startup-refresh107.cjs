'use strict';
async function refresh(sync,session,requireSession){
 if(session.mode!=='online'||!sync?.local?.bound())return {verified:false,status:'offline',reason:'Acesso local; central não confirmada.'};
 try{
  await sync.kick();
  const current=requireSession();
  if(String(current.userId)!==String(session.userId))throw Error('Sessão alterada durante a conferência. Entre novamente.');
  const state=sync.status();
  if(!sync.authenticated||['offline','login','local'].includes(state.state)||state.conflicts)return {verified:false,status:state.state||'offline',reason:state.conflicts?'Há conflitos de sincronização pendentes.':'Central indisponível. Os registros locais continuam disponíveis.'};
  return {verified:true,status:state.state,reason:''};
 }catch(error){
  if(/Sessão alterada/.test(error.message||''))throw error;
  return {verified:false,status:'offline',reason:'Não foi possível consultar a central. Os dados locais podem estar desatualizados.'};
 }
}
module.exports={refresh};
