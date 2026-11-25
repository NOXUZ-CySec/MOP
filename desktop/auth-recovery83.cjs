'use strict';
const {createClient}=require('@supabase/supabase-js');
const config=require('./supabase-config.cjs');
const MAX_LINK=4096;
function parseRecoveryLink(link){
 if(typeof link!=='string'||link.length>MAX_LINK)throw Error('Link de recuperação inválido.');
 let url;try{url=new URL(link.trim())}catch{throw Error('Cole o endereço completo do link recebido por e-mail.');}
 if(url.protocol!=='https:'||url.hostname!==new URL(config.url).hostname||url.pathname!=='/auth/v1/verify'||url.username||url.password||url.port||url.searchParams.get('type')!=='recovery')throw Error('Use somente o link original de recuperação enviado pelo Supabase do MOP.');
 const token=url.searchParams.get('token_hash')||url.searchParams.get('token');
 if(!token||!/^[-_a-zA-Z0-9]{10,512}$/.test(token))throw Error('O link de recuperação não contém um código válido.');
 return token;
}
function client(){return createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
let lastRequested=0;
async function request(login){if(typeof login!=='string'||login.trim().length>254||login.trim().length<3)throw Error('Informe seu usuário ou e-mail.');if(Date.now()-lastRequested<60000)throw Error('Aguarde um minuto antes de solicitar outro e-mail.');lastRequested=Date.now();const c=client();try{let email=login.trim().toLowerCase();if(!email.includes('@')){const result=await c.rpc('mop_resolve_login',{p_login:email});if(result.error)throw Error('Serviço de recuperação indisponível. Tente novamente.');email=typeof result.data==='string'?result.data:'';}if(email.includes('@')){const {error}=await c.auth.resetPasswordForEmail(email);if(error&&/rate.limit|too.many/i.test(error.message||''))throw Error('Muitas solicitações de recuperação. Aguarde alguns minutos.');if(error)throw Error('Não foi possível solicitar a recuperação. Confira a conexão e tente novamente.');}return {sent:true}}finally{await c.auth.signOut({scope:'local'}).catch(()=>{});}}
async function finish(link,password){const token=parseRecoveryLink(link);if(typeof password!=='string'||password.length<12||password.length>128)throw Error('A nova senha deve conter entre 12 e 128 caracteres.');const c=client();try{const {error}=await c.auth.verifyOtp({token_hash:token,type:'recovery'});if(error)throw Error('Link inválido, expirado ou já utilizado. Solicite outro e-mail de recuperação.');const updated=await c.auth.updateUser({password});if(updated.error)throw Error('Não foi possível alterar a senha. Confira os requisitos e tente novamente.');return {updated:true}}finally{await c.auth.signOut({scope:'local'}).catch(()=>{});}}
module.exports={parseRecoveryLink,request,finish};