'use strict';
const fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {empty}=require('./store.cjs');
const shift=require('../src/shift.js');
const ops=require('../src/operations.js');
const milestone='scenario-preview11-v1.txt';
const reset='reset-preview11-requested.txt';
const allowedBase='MOP-Preview-Homologacao-11';
const demo='[DEMONSTRAÇÃO]';
function dateWithOffset(base,hours){return new Date(base.getTime()+hours*3600000).toISOString();}
function localMinute(date){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(date)).map(x=>[x.type,x.value]));
  return parts.year+'-'+parts.month+'-'+parts.day+'T'+parts.hour+':'+parts.minute;
}
const specs=[
  ['Condominio Demo','Câmera do acesso principal offline','Ocorrência','Urgente','Pendente',-5,-3,'Acionar manutenção e acompanhar retorno do NVR.','Digifort','Operadora Camila'],
  ['Condominio Demo','Falha intermitente na leitura de badge','Acesso','Atenção','Em andamento',-22,-7,'Validar logs do controlador e confirmar testes de acesso.','Lenel','Operador Rafael'],
  ['Condominio Demo','Solicitação de imagens do estacionamento','Solicitação de Vídeo/Imagens','Normal','Aguardando resposta',-30,12,'Aguardar autorização e confirmar janela das imagens.','E-mail','Operadora Camila'],
  ['Condominio Demo','Gerenciadora do bloco B sem comunicação','Gerenciadora e/ou Dispositivo offline','Urgente','Aguardando manutenção',-32,-4,'Confirmar visita técnica e comunicar a supervisão.','Monitoramento','Operador Rafael'],
  ['Condominio Demo','Cadastro de prestador para segunda-feira','Cadastro futuro','Normal','Pendente',-4,36,'Conferir autorização antes do cadastro.','Telefone','Operadora Camila'],
  ['Condominio Demo','Ocorrência de acesso fora do horário','Acesso','Atenção','Em andamento',-55,10,'Verificar imagens e registrar conclusão da apuração.','Portaria','Operador Rafael'],
  ['Condominio Demo','Relatório mensal de ocorrências','Solicitação de Relatório','Normal','Aguardando resposta',-73,30,'Revisar relatório com a supervisão.','E-mail','Supervisor Demo'],
  ['Condominio Demo','Equipamento de gravação com aviso SMART','Equipamento/Manutenção','Urgente','Pendente',-8,3,'Providenciar inspeção preventiva do disco.','Digifort','Operadora Camila'],
  ['Condominio Demo','Verificação de rede após oscilação','Falta de internet','Atenção','Resolvido',-120,-68,'Rotina normalizada após correção de rota.','NOC','Operador Rafael'],
  ['Condominio Demo','Solicitação de liberação veicular','Liberação veicular','Normal','Resolvido',-67,-32,'Credencial revisada; conclusão registrada.','E-mail','Operadora Camila'],
  ['Condominio Demo','Falha em sensor de porta técnica','Equipamento/Manutenção','Atenção','Resolvido',-210,-161,'Sensor substituído e testado.','Monitoramento','Supervisor Demo'],
  ['Condominio Demo','Alarme de energia em rack de telecom','Falta de Energia','Urgente','Resolvido',-14,2,'UPS conferido e alarme encerrado.','Monitoramento','Operador Rafael'],
  ['Condominio Restrito Demo','Solicitação de cadastro administrativo','Cadastro futuro','Normal','Pendente',-26,23,'Validar autorização do setor responsável.','E-mail','Operadora Júlia'],
  ['Condominio Restrito Demo','Câmera de doca em manutenção','Equipamento/Manutenção','Atenção','Em andamento',-47,-6,'Acompanhar chamado técnico e restabelecimento da imagem.','Digifort','Operadora Júlia']
];
function createScenario(now=new Date()){
  const state=empty(),events=[];const base=new Date(now);
  state.items=specs.map(([condo,subject,category,priority,status,createdHours,deadlineHours,next_action,source,author],i)=>{
    const id=i+1,created_at=dateWithOffset(base,createdHours),due=localMinute(dateWithOffset(base,deadlineHours));
    const resolved=status==='Resolvido',updated_at=resolved?dateWithOffset(base,Math.min(-1,createdHours/2)):dateWithOffset(base,Math.max(createdHours+1,createdHours/3));
    const row={id,protocol:'MOP-'+ops.dateKey(created_at).replaceAll('-','')+'-DEMO'+String(id).padStart(8,'0'),subject:demo+' '+subject,
      description:'Cenário fictício para a apresentação aos gestores. Nenhuma pessoa, condomínio, equipamento ou ocorrência real está representada.',category,priority,status,condo,
      company:'Operação demonstrativa NOXUZ',created_at,updated_at,created_shift:shift.at(created_at),updated_shift:shift.at(updated_at),
      created_by:author,updated_by:resolved?'Supervisor Demo':author,action_taken:resolved?'Atendimento concluído após verificação e registro da evidência.':'Pendência revisada e encaminhada à equipe responsável.',
      next_action,source,reference:'DEMO-'+String(id).padStart(3,'0'),deadline:due,assignee:author};
    if(resolved)row.resolved_at=updated_at;
    events.push({id:events.length+1,item_id:id,at:created_at,shift:shift.at(created_at),actor:author,kind:'Criado',detail:'Abertura fictícia para homologação.'});
    if(status!=='Pendente')events.push({id:events.length+1,item_id:id,at:updated_at,shift:shift.at(updated_at),actor:row.updated_by,kind:resolved?'Resolvido':'Atualizado',detail:'Acompanhamento demonstrativo: '+status});
    return row;
  });
  state.nextItem=state.items.length+1;
  state.events=events;state.nextEvent=events.length+1;
  state.handovers=[-72,-48,-24].map((hours,i)=>{
    const at=dateWithOffset(base,hours),delivered_at=at,receipt_at=dateWithOffset(base,hours+0.25),s=shift.at(at);
    const snapshot=state.items.filter(item=>item.status!=='Resolvido'&&item.condo==='Condominio Demo').slice(i,i+5).map(row=>JSON.parse(JSON.stringify(row)));
    return {id:i+1,at,delivered_at,receipt_at,shift:s,delivery_slot:s.date+(s.type==='Diurno'?'-D':'-N'),receipt_slot:s.date+(s.type==='Diurno'?'-D':'-N'),
      outgoing:i%2?'Operador Rafael':'Operadora Camila',incoming:i%2?'Operadora Camila':'Operador Rafael',
      handover_note:['Câmeras prioritárias conferidas. Aguardar retorno da manutenção e acompanhar os prazos pendentes.','Verificada situação dos acessos. Continuidade dos chamados técnicos permanece no próximo turno.','Conferir ocorrências urgentes no início do turno e registrar qualquer divergência.'][i],
      receipt_note:'Recebimento confirmado. Pendências repassadas à equipe.',open_ids:JSON.stringify(snapshot.map(r=>r.id)),snapshot};
  });
  state.nextHandover=state.handovers.length+1;
  state.templates=[{id:1,key:'demo-verificacao-cameras',title:'[DEMONSTRAÇÃO] Conferência preventiva de câmeras',condo:'Condominio Demo',frequency:'daily',start_date:ops.dateKey(now),time:'23:59',steps:['Verificar recepção de vídeo','Conferir alertas de gravação','Registrar pendências para o próximo turno'],active:true}];
  state.nextTemplate=2;
  return state;
}
function checkBase(userData){
 if(path.basename(userData)!==allowedBase)throw Error('Restauração disponível somente no perfil isolado de homologação Preview.11.');
 return userData;
}
function prepareOnLaunch(userData){
 checkBase(userData);
 const flag=path.join(userData,reset);
 if(!fs.existsSync(flag))return false;
 const current=path.join(userData,'dados');
 if(fs.existsSync(current)){
   const backups=path.join(userData,'restauracoes-anteriores');fs.mkdirSync(backups,{recursive:true});
   const saved=path.join(backups,new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID());
   fs.renameSync(current,saved);
 }
 try{fs.unlinkSync(path.join(userData,milestone));}catch(e){if(e.code!=='ENOENT')throw e;}
 fs.unlinkSync(flag);
 return true;
}
function initialize(store,userData,now=new Date()){
 checkBase(userData);
 const flag=path.join(userData,milestone),current=store.read();
 if(fs.existsSync(flag)||current.items.length)return false;
 const state=createScenario(now);
 store.write(state);
 fs.writeFileSync(flag,'Cenário 100% fictício, isolado do Supabase operacional.','utf8');
 return true;
}
function requestReset(userData){
 checkBase(userData);
 fs.writeFileSync(path.join(userData,reset),'Solicitada pelo administrador da homologação.');
 return true;
}
module.exports={specs,createScenario,prepareOnLaunch,initialize,requestReset,allowedBase};
