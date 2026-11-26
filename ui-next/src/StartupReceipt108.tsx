import { PageHeader, PageAction } from "./PageHeader";
import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeftRight,AlertTriangle,RefreshCw,LogOut,ClipboardCheck,Clock3,Info,UserRound} from 'lucide-react';
import './startup108.css';

type Item={
 id:string;title:string;description:string;condo:string;category:string;status:string;priority:string;
 occurredAt:string;version:string;critical:boolean;createdDuringOutgoing:boolean;
 assignee?:string;nextAction?:string;actionTaken?:string;deadline?:string|null;overdue?:boolean;createdDuringCurrent?:boolean;
};
type Snapshot={
 shiftId:string;shiftLabel:string;deliveryId:number|null;outgoing:string|null;deliverySummary:string;
 selfDelivery:boolean;canBootstrap:boolean;token:string;items:Item[];createdCount:number;criticalCount:number;
 openCount?:number;availableRecords?:number;centralVerified?:boolean;syncStatus?:string;syncReason?:string;
 accepted:boolean;acceptedAt:string|null;
};
type Props={
 identity:string;onAccepted:()=>void;onExit:()=>void;isDemo?:boolean;
 windowActions?:React.ReactNode;secondaryDialogOpen?:boolean;windowError?:string;
};
const demo:Snapshot={
 shiftId:'DEMO-DIURNO',shiftLabel:'Turno de demonstração',deliveryId:101,outgoing:'Operador demonstrativo anterior',
 deliverySummary:'Situação do plantão: uma câmera precisa de acompanhamento.\n\nContinuidade: conferir a comunicação da portaria e registrar o resultado no próximo plantão.',
 selfDelivery:false,canBootstrap:false,token:'demo',createdCount:2,criticalCount:1,openCount:1,availableRecords:2,accepted:false,acceptedAt:null,
 items:[
  {id:'DEMO-01',title:'Câmera sem comunicação',description:'A câmera da portaria está sem comunicação. A equipe foi informada e o acompanhamento precisa continuar.',condo:'Unidade simulada',category:'Segurança',status:'Pendente',priority:'Urgente',occurredAt:new Date().toISOString(),version:'v1',critical:true,createdDuringOutgoing:true,assignee:'Equipe do próximo turno',nextAction:'Verificar a comunicação da câmera e registrar o resultado.',actionTaken:'Equipe informada sobre a indisponibilidade.'},
  {id:'DEMO-02',title:'Rotina de monitoramento',description:'Conferir o registro do plantão anterior.',condo:'Unidade simulada',category:'Rotina',status:'Concluído',priority:'Normal',occurredAt:new Date().toISOString(),version:'v1',critical:false,createdDuringOutgoing:true}
 ]
};
function dateLabel(value?:string|null){
 if(!value)return '';
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value.split('-').reverse().join('/');
 const date=new Date(value);
 return Number.isFinite(+date)?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date):value;
}
export default function StartupReceipt108({identity,onAccepted,onExit,isDemo=false,windowActions,secondaryDialogOpen=false,windowError}:Props){
 const [data,setData]=useState<Snapshot|null>(null),[dataIdentity,setDataIdentity]=useState('');
 const [confirmed,setConfirmed]=useState<string[]>([]),[declaration,setDeclaration]=useState(false);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[fresh,setFresh]=useState(false),[error,setError]=useState('');
 const alive=useRef(false),busy=useRef(false),operation=useRef(0);
 const root=useRef<HTMLElement|null>(null),title=useRef<HTMLHeadingElement|null>(null);
 const sourceKey=JSON.stringify([identity,isDemo]),source=useRef(sourceKey),callbacks=useRef({onAccepted});
 source.current=sourceKey;callbacks.current={onAccepted};
 const snapshot=dataIdentity===sourceKey?data:null;

 const refresh=async()=>{
  if(!alive.current||busy.current)return;
  busy.current=true;
  const request=++operation.current,current=()=>alive.current&&source.current===sourceKey&&operation.current===request;
  // A new consultation invalidates previous confirmations even when that consultation fails.
  setFresh(false);setConfirmed([]);setDeclaration(false);setLoading(true);setError('');
  try{
   const result=isDemo?demo:await window.mopDesktop?.startup108?.('snapshot') as Snapshot|undefined;
   if(!current())return;
   if(!result||!Array.isArray(result.items)||typeof result.token!=='string')throw Error('Consulta de recebimento indisponível. Atualize a conferência para tentar novamente.');
   setData(result);setDataIdentity(sourceKey);setFresh(true);
   if(result.accepted)callbacks.current.onAccepted();
  }catch(e){
   if(current()){setFresh(false);setError(e instanceof Error?e.message:'Não foi possível consultar os dados do turno. Atualize a conferência para tentar novamente.');}
  }finally{
   if(current()){busy.current=false;setLoading(false);}
  }
 };
 useEffect(()=>{
  alive.current=true;busy.current=false;operation.current+=1;
  setData(null);setDataIdentity('');setFresh(false);setConfirmed([]);setDeclaration(false);setSaving(false);
  void refresh();
  const focus=requestAnimationFrame(()=>{if(alive.current&&source.current===sourceKey)title.current?.focus({preventScroll:true});});
  return()=>{alive.current=false;busy.current=false;operation.current+=1;cancelAnimationFrame(focus);};
 },[sourceKey]);
 useEffect(()=>{
  if(secondaryDialogOpen)return;
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();return;}
   if(event.key!=='Tab'||event.defaultPrevented)return;
   const elements=Array.from(root.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')||[])
    .filter(element=>element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden');
   const first=elements[0],last=elements.at(-1);
   if(!first||!last){event.preventDefault();title.current?.focus({preventScroll:true});return;}
   const active=document.activeElement as HTMLElement|null;
   if(!active||!elements.includes(active)){event.preventDefault();(event.shiftKey?last:first).focus();return;}
   if(event.shiftKey&&active===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&active===last){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',onKey);
  return()=>document.removeEventListener('keydown',onKey);
 },[secondaryDialogOpen]);

 const items=snapshot?.items||[];
 const urgent=items.filter(item=>item.critical||item.overdue).sort((a,b)=>Number(!!b.overdue)-Number(!!a.overdue));
 const other=items.filter(item=>!item.critical&&!item.overdue);
 const checked=items.filter(item=>confirmed.includes(item.id)).length,remaining=items.length-checked;
 const mayReceive=!!snapshot&&((!!snapshot.deliveryId&&!snapshot.selfDelivery)||snapshot.canBootstrap);
 const controlsDisabled=loading||saving||!fresh;
 const ready=!!snapshot&&fresh&&!error&&!loading&&!saving&&mayReceive&&declaration&&items.every(item=>confirmed.includes(item.id));
 const bootstrap=!!snapshot?.canBootstrap&&!snapshot.deliveryId;
 const submit=async()=>{
  if(!ready||busy.current||!snapshot)return;
  busy.current=true;
  const request=++operation.current,current=()=>alive.current&&source.current===sourceKey&&operation.current===request;
  setSaving(true);setError('');
  try{
   const response=isDemo?{accepted:true}:await window.mopDesktop?.startup108?.('receive',{
    deliveryId:snapshot.deliveryId,bootstrap:snapshot.canBootstrap&&!snapshot.deliveryId,shiftId:snapshot.shiftId,token:snapshot.token,
    confirmedIds:[...confirmed],readVersions:Object.fromEntries(snapshot.items.filter(item=>item.critical).map(item=>[item.id,item.version]))
   }) as {accepted:boolean}|undefined;
   if(!current())return;
   if(!response?.accepted)throw Error('O sistema não confirmou o recebimento. Atualize a conferência antes de tentar novamente.');
   callbacks.current.onAccepted();
  }catch(e){
   if(current()){
    setFresh(false);setConfirmed([]);setDeclaration(false);
    setError(e instanceof Error?e.message:'Não foi possível registrar o recebimento. Atualize a conferência antes de tentar novamente.');
   }
  }finally{
   if(current()){busy.current=false;setSaving(false);}
  }
 };
 const progressText=loading?'Consultando o turno…':!snapshot||!fresh?'Atualize os dados para continuar.':remaining?
  'Falta'+(remaining===1?' 1 registro':'m '+remaining+' registros')+' para conferir.':items.length?'Todos os registros foram conferidos.':'Não há registros disponíveis nesta conferência.';
 const actionHelp=loading?'Aguarde a consulta dos dados.':!fresh?'Uma nova consulta é necessária antes do aceite.':snapshot?.selfDelivery?
  'O recebimento desta entrega exige outra conta autenticada.':!mayReceive?'Aguarde uma entrega ou consulte a supervisão.':remaining?
  'Leia cada registro e marque a confirmação individual.':!declaration?'Confirme a declaração de ciência para continuar.':isDemo?'Demonstração: nenhum aceite operacional será gravado.':
  snapshot?.centralVerified===false?'O recebimento será salvo nesta estação para sincronização posterior.':'A confirmação registra o recebimento e libera a central operacional.';

 const renderItem=(item:Item)=>{
  const read=confirmed.includes(item.id);
  return <article key={item.id} data-record-id={item.id} className={'mop108-record'+(item.critical||item.overdue?' critical':'')+(read?' is-confirmed':'')}>
   <div className="mop108-record-heading">
    <div className="mop108-record-identity"><code>{item.id}</code><h3>{item.title}</h3></div>
    <div className="mop108-record-badges">
     {item.overdue?<span className="mop108-critlabel"><Clock3 size={13}/>Prazo vencido</span>:item.critical&&<span className="mop108-critlabel"><AlertTriangle size={13}/>Leitura prioritária</span>}
     <span className="mop108-item-status">{item.status}</span>
    </div>
   </div>
   <div className="mop108-record-location"><strong>{item.condo||'Condomínio não informado'}</strong><span>{item.category||'Categoria não informada'}</span>{item.priority&&<span>Prioridade: {item.priority}</span>}</div>
   <p className="mop108-record-description">{item.description||'Sem descrição adicional.'}</p>
   {item.actionTaken?.trim()&&<div className="mop108-action-taken"><span>Providências registradas</span><p>{item.actionTaken}</p></div>}
   <dl className="mop108-continuity">
    <div><dt>Responsável</dt><dd>{item.assignee?.trim()||'Não informado'}</dd></div>
    <div><dt>Próxima ação</dt><dd>{item.nextAction?.trim()||'Não informada'}</dd></div>
    {item.deadline&&<div className={item.overdue?'is-overdue':''}><dt>Prazo</dt><dd><time dateTime={item.deadline}>{dateLabel(item.deadline)}</time></dd></div>}
   </dl>
   <div className="mop108-record-foot">
    <span className="mop108-record-context">{item.createdDuringCurrent?'Criado neste turno':item.createdDuringOutgoing?'Criado no turno anterior':'Registro para continuidade'}{item.occurredAt&&<> · <time dateTime={item.occurredAt}>{dateLabel(item.occurredAt)}</time></>}</span>
    <label className="mop108-read"><input type="checkbox" aria-label={'Li este registro '+item.id} checked={read} disabled={controlsDisabled} onChange={event=>setConfirmed(old=>event.target.checked?Array.from(new Set([...old,item.id])):old.filter(value=>value!==item.id))}/><span>Li este registro</span></label>
   </div>
  </article>;
 };
 return <div className="mop108-backdrop"><section className="mop108-dialog" role="dialog" aria-modal="true" ref={root} aria-labelledby="mop108-title" aria-describedby="mop108-purpose">
  <div className="mop108-windowbar"><span className="mop108-window-brand">MOP<span>Ciência de turno</span></span><div className="mop108-window-right"><button type="button" className="mop108-logout" onClick={onExit} disabled={saving}><LogOut size={14}/><span>Trocar conta</span></button>{windowActions&&<div className="mop108-window-actions">{windowActions}</div>}</div></div>
  <div className="mop108-frame">
   <PageHeader page="handover" title="Recebimento e ciência do turno" titleId="mop108-title" titleRef={title} titleTabIndex={-1}
    description="Confira a entrega e as pendências do plantão." descriptionId="mop108-purpose" actions={
    <PageAction kind="refresh" onClick={()=>void refresh()} disabled={loading||saving}>Atualizar conferência</PageAction>
   }/>
   <div className="mop108-review-surface">
   <div className="mop108-body" aria-busy={loading||saving}>
    {snapshot&&!fresh&&!loading&&<p className="mop108-stale-notice"><AlertTriangle size={15}/>Os dados abaixo são da consulta anterior. Atualize a conferência antes de registrar o aceite.</p>}
    {loading?<div className="mop108-loading" role="status"><RefreshCw size={23} className="mop108-spin"/><strong>Consultando a entrega e os registros do turno</strong><p>Aguarde para iniciar a conferência.</p></div>:snapshot?<>
     <div className={'mop108-briefing'+(snapshot.deliverySummary?.trim()?' has-summary':'')}>
     <section className="mop108-context" aria-label="Contexto da passagem de turno">
      <div className="mop108-context-top"><span><ArrowLeftRight size={16}/>{snapshot.shiftLabel}</span><small className={isDemo?'is-demo':snapshot.centralVerified===false?'is-local':''}>{isDemo?'Dados fictícios':snapshot.centralVerified===true?'Consulta confirmada na central':snapshot.centralVerified===false?'Conferência nesta estação':'Dados disponíveis para conferência'}</small></div>
      <dl className="mop108-people"><div><dt><UserRound size={13}/>Recebendo o turno</dt><dd>{identity}</dd></div><div><dt>Entregue por{snapshot.deliveryId?' · #'+snapshot.deliveryId:''}</dt><dd>{snapshot.outgoing||'Sem entrega anterior'}</dd></div></dl>
      {(!snapshot.deliveryId||snapshot.selfDelivery)&&<p className={'mop108-intro'+(snapshot.selfDelivery||!mayReceive?' is-attention':'')}>{snapshot.selfDelivery?'Esta entrega foi realizada com sua conta. Troque de conta para que outro operador registre o recebimento.':snapshot.canBootstrap?(!isDemo&&snapshot.centralVerified===false?'Não há entrega anterior nesta estação. Antes de registrar o início, confirme com a equipe se houve uma entrega em outro computador.':'Não há entrega anterior registrada. Confira os registros apresentados antes de registrar o início do turno.'):'Ainda não há uma entrega aguardando recebimento. Atualize a conferência ou consulte a supervisão.'}</p>}
      {!isDemo&&snapshot.centralVerified===false&&<p className="mop108-sync-notice"><Info size={15}/><span>{snapshot.syncReason||'A central não confirmou os dados desta consulta.'} Uma entrega feita em outro computador pode não aparecer aqui.</span></p>}
     </section>
     {snapshot.deliverySummary?.trim()?<section className="mop108-handover-note" aria-labelledby="mop108-summary-title"><h2 id="mop108-summary-title">Resumo deixado pelo plantão anterior</h2><p>{snapshot.deliverySummary}</p></section>:snapshot.deliveryId?<p className="mop108-summary-missing"><Info size={15}/>Esta entrega não contém um resumo. Confira com atenção os registros e as orientações abaixo.</p>:null}
     </div>
     {!isDemo&&snapshot.availableRecords===0&&<p className="mop108-empty-notice" role="status"><AlertTriangle size={16}/><span>Nenhum registro foi localizado na base visível desta estação. Confira a sincronização: esta lista não comprova ausência de ocorrências na central.</span></p>}
     <div className="mop108-list" aria-label="Registros de conferência">
      {urgent.length>0&&<section className="mop108-group" aria-labelledby="mop108-priority-title"><div className="mop108-group-title"><div><h2 id="mop108-priority-title"><AlertTriangle size={17}/>Prioridade de leitura</h2><p>Críticos e prazos vencidos vêm primeiro.</p></div><span>{urgent.length} {urgent.length===1?'registro':'registros'}</span></div>{urgent.map(renderItem)}</section>}
      {other.length>0&&<section className="mop108-group" aria-labelledby="mop108-other-title"><div className="mop108-group-title"><div><h2 id="mop108-other-title">{urgent.length?'Demais registros do turno':'Registros para conferência'}</h2><p>Confira também as ocorrências concluídas e o contexto do plantão.</p></div><span>{other.length} {other.length===1?'registro':'registros'}</span></div>{other.map(renderItem)}</section>}
      {!items.length&&<div className="mop108-empty"><ClipboardCheck size={24}/><div><h2>Nenhum registro disponível para conferência</h2><p>{bootstrap?'Confira o contexto acima e a declaração antes de registrar o início do turno.':'Revise o resumo da entrega e confirme a declaração de ciência para continuar.'}</p></div></div>}
     </div>
    </>:<div className="mop108-loading"><AlertTriangle size={24}/><strong>A conferência ainda não está disponível</strong><p>Use Atualizar conferência para consultar os dados do turno.</p></div>}
   </div>
   <footer className="mop108-footer">
    {(error||windowError)&&<div className="mop108-error" role="alert"><AlertTriangle size={15}/><span>{error||windowError}</span></div>}
    <div className="mop108-reading-progress" role="status" aria-live="polite"><div><span>{progressText}</span>{snapshot&&fresh&&!loading&&<strong>{checked} de {items.length} conferidos</strong>}</div><progress value={fresh?(items.length?checked:1):0} max={items.length||1} aria-label="Registros conferidos"/></div>
    <div className="mop108-final-row"><label className="mop108-confirm" htmlFor="mop108-declaration"><input id="mop108-declaration" type="checkbox" checked={declaration} disabled={!snapshot||controlsDisabled} onChange={event=>setDeclaration(event.target.checked)}/><span>Conferi os registros apresentados e assumo a continuidade das pendências deste turno.</span></label><button type="button" className="mop108-submit" disabled={!ready} onClick={()=>void submit()}>{saving?<RefreshCw size={17} className="mop108-spin"/>:<ClipboardCheck size={17}/>}<span>{saving?'Registrando recebimento…':bootstrap?'Registrar início e entrar':'Confirmar recebimento e entrar'}</span></button></div>
    <p className="mop108-action-help">{actionHelp}</p>
   </footer>
   </div>
  </div>
 </section></div>;
}
