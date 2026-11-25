'use strict';
// Conta fictícia exclusivamente para o instalador de homologação.
// Nenhuma chamada é enviada ao Supabase real.
const workspace='88888888-8888-4888-8888-888888888888';
const demoPassword='MOP-Demo-2026!';
const members=[
  {user_id:'88888888-8888-4888-8888-888888888801',username:'admin.teste',display_name:'Administrador Teste',role:'admin',condos:null},
  {user_id:'88888888-8888-4888-8888-888888888802',username:'supervisor.teste',display_name:'Supervisor Teste',role:'supervisor',condos:null},
  {user_id:'88888888-8888-4888-8888-888888888803',username:'operador.teste',display_name:'Colaborador Teste',role:'operator',condos:['Condominio Demo']},
  {user_id:'88888888-8888-4888-8888-888888888804',username:'consulta.teste',display_name:'Consulta Teste',role:'viewer',condos:['Condominio Demo']}
].map(x=>({...x,workspace_id:workspace,access_version:1,email:x.username+'@mop-preview.test'}));
const receipts=new Map(),records=new Map();
let revision=0;
function createClient(){
  let session=null;
  const auth={
    async signInWithPassword({email,password}){
      const m=members.find(x=>x.email===String(email||'').trim().toLowerCase());
      if(!m||password!==demoPassword)return {data:{user:null,session:null},error:{code:'invalid_credentials',status:400,message:'Usuário ou senha de demonstração incorretos.'}};
      session={user:{id:m.user_id,email:m.email}};
      return {data:{user:session.user,session},error:null};
    },
    async getSession(){return {data:{session},error:null};},
    async signOut(){session=null;return {error:null};},
    stopAutoRefresh(){}
  };
  const from=table=>{
    let cursor=0,filters={};
    const query={
      select(){return query;},eq(key,value){filters[key]=value;return query;},
      gt(_key,value){cursor=Number(value)||0;return query;},order(){return query;},limit(){return query;},
      then(resolve,reject){return Promise.resolve().then(()=>{
        if(table==='mop_members')return {data:members.filter(m=>Object.entries(filters).every(([k,v])=>m[k]===v)).map(({email,...m})=>({...m})),error:null};
        if(table==='mop_records')return {data:[...records.values()].filter(r=>r.revision>cursor).sort((a,b)=>a.revision-b.revision),error:null};
        return {data:[],error:null};
      }).then(resolve,reject);}
    };
    return query;
  };
  async function rpc(name,p={}){
    if(name==='mop_resolve_login'){
      const m=members.find(x=>x.username===String(p.p_login||'').trim().toLowerCase());
      return {data:m?.email||null,error:null};
    }
    if(name==='mop_list_members')return {data:members.map(({email,...m})=>({...m})),error:null};
    if(name==='mop_set_operator_220'){
      const m=members.find(x=>x.user_id===p.p_user_id);
      if(!m)return {data:null,error:{message:'Conta fictícia não encontrada neste laboratório.'}};
      if(!['admin','supervisor','operator','viewer'].includes(p.p_role))return {data:null,error:{message:'Perfil inválido.'}};
      if(m.role==='admin'&&p.p_role!=='admin')return {data:null,error:{message:'O administrador de demonstração é protegido.'}};
      Object.assign(m,{username:p.p_username,display_name:p.p_display_name,role:p.p_role,condos:p.p_condos,access_version:m.access_version+1});
      return {data:true,error:null};
    }
    if(name==='mop_push'){
      if(receipts.has(p.p_op))return {data:receipts.get(p.p_op),error:null};
      const previous=records.get(p.p_id),version=Math.max(previous?.version||0,Number(p.p_base)||0)+1;
      const record={id:p.p_id,kind:p.p_kind,payload:p.p_payload,version,revision:++revision};
      records.set(record.id,record);
      const result={ok:true,record};receipts.set(p.p_op,result);
      return {data:result,error:null};
    }
    return {data:null,error:{message:'Função não disponível no ambiente de demonstração.'}};
  }
  const channel=()=>{const c={on(){return c;},subscribe(){return c;}};return c;};
  return {auth,from,rpc,channel,async removeChannel(){}};
}
module.exports={createClient,members,demoPassword,workspace};
