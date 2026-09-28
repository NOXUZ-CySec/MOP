'use strict';
const {randomUUID}=require('node:crypto');
module.exports=function cloud(){
  let offline=false,allowed=true,session=null,revision=0,realtime=()=>{};
  const rows=new Map(),receipts=new Map();
  const network=()=>{if(offline)throw Object.assign(Error('fetch failed'),{name:'AuthRetryableFetchError',status:0});};
  const client={
    auth:{getSession:async()=>({data:{session}}),signInWithPassword:async({email,password})=>{
      network();if(password!=='test-only')return {error:{status:400,code:'invalid_credentials',message:'Invalid credentials'}};
      session={user:{id:'11111111-1111-4111-8111-111111111111',email}};return {data:{user:session.user,session}};
    },stopAutoRefresh:()=>{}},
    channel:()=>{const c={on:(_type,_filter,callback)=>{realtime=callback;return c;},subscribe:()=>c};return c;},removeChannel:async()=>{},
    from:table=>{
      let cursor=0;const q={select:()=>q,eq:()=>q,gt:(_key,value)=>{cursor=value;return q;},order:()=>q,limit:()=>q,
        then:(resolve,reject)=>Promise.resolve().then(()=>{network();return {data:table==='mop_members'?(allowed?[{workspace_id:'00000000-0000-4000-8000-000000000001'}]:[]):[...rows.values()].filter(r=>r.revision>cursor).sort((a,b)=>a.revision-b.revision)};}).then(resolve,reject)};return q;
    },
    rpc:async(_name,p)=>{
      network();if(receipts.has(p.p_op))return {data:receipts.get(p.p_op)};
      const old=rows.get(p.p_id);if(old&&old.version!==p.p_base)return {data:{ok:false,record:old}};
      const record={id:p.p_id,kind:p.p_kind,payload:p.p_payload,version:(old?.version||0)+1,revision:++revision};rows.set(record.id,record);
      const result={ok:true,record};receipts.set(p.p_op,result);return {data:result};
    }
  };
  return {client,rows,offline:value=>{offline=value;},allowed:value=>{allowed=value;},change:(id,payload)=>{const old=rows.get(id);rows.set(id,{...old,payload,version:old.version+1,revision:++revision});realtime();}};
};
