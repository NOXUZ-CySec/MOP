import { PageHeader } from "./PageHeader";
import {useEffect,useMemo,useRef,useState} from 'react';
import {AlertTriangle,ArrowLeftRight,CheckCircle2,LoaderCircle,RotateCw,ShieldCheck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle} from '@/components/ui/alert-dialog';
import HandoverPage,{type HandoverSnapshot,type HandoverCommand,type HandoverDraft110,type HandoverItem} from './HandoverPage';
import {ReadCoordinator1098,type ReadSession1098} from './queries1098/readCoordinator1098';
import {readHandoverDraft110,reconcileHandoverDraft110,saveHandoverDraft110} from './handoverDraft110';

type BackendItem=Omit<HandoverItem,'icon'>;
type BackendSnapshot=Omit<HandoverSnapshot,'items'|'criticalConfirmations'|'deliveredItems'> & {items:BackendItem[];deliveredItems?:BackendItem[]};
type CommandResult={id:number;protocol?:string;action:string;changed?:boolean;syncState?:string};
type Confirmation={command:Exclude<HandoverCommand,{kind:'assignPending'}>;signature:string;session:ReadSession1098};
type Props={sessionScope:ReadSession1098|null;onOpenRecord:(id:string)=>void;onNavigateRoutines?:()=>void};
const itemView=(item:BackendItem):HandoverItem=>({...item,icon:item.status==='Concluído'?CheckCircle2:item.critical?AlertTriangle:RotateCw});
const normalize=(raw:BackendSnapshot):HandoverSnapshot=>{
  if(!raw||!Array.isArray(raw.items)||!raw.stage)throw Error('A passagem retornou informações incompletas. Atualize e tente novamente.');
  return {...raw,deliverySummary:raw.deliverySummary||'',receiptNote:raw.receiptNote||'',criticalConfirmations:{},items:raw.items.map(itemView),deliveredItems:(raw.deliveredItems||[]).map(itemView)};
};
// updatedAt is the snapshot query time, not a material change to the handover.
const signature=(snapshot:HandoverSnapshot)=>JSON.stringify({...snapshot,updatedAt:undefined,criticalConfirmations:undefined});
const messageOf=(error:unknown,fallback:string)=>error instanceof Error?error.message:fallback;

export default function OperationalHandover36({sessionScope,onOpenRecord,onNavigateRoutines}:Props){
  const [snapshot,setSnapshot]=useState<HandoverSnapshot|null>(null),[draft,setDraft]=useState<HandoverDraft110>();
  const [loadError,setLoadError]=useState(''),[actionError,setActionError]=useState(''),[reviewMessage,setReviewMessage]=useState('');
  const [success,setSuccess]=useState<{text:string;tone:'success'|'warning'}|null>(null);
  const [refreshing,setRefreshing]=useState(false),[mutating,setMutating]=useState(false),[stale,setStale]=useState(true),[lastUpdated,setLastUpdated]=useState<string>();
  const [confirming,setConfirming]=useState<Confirmation|null>(null);
  const reader=useMemo(()=>new ReadCoordinator1098<BackendSnapshot>(),[]);
  const mounted=useRef(false),sessionRef=useRef(sessionScope),snapshotRef=useRef<HandoverSnapshot|null>(null),draftRef=useRef<HandoverDraft110|undefined>(undefined);
  const refreshingRef=useRef(false),mutatingRef=useRef(false),staleRef=useRef(true),confirmationRef=useRef<Confirmation|null>(null);
  const loadId=useRef(0),commandId=useRef(0),reviewSignature=useRef(''),queuedRefresh=useRef(false);
  const triggerRef=useRef<HTMLElement|null>(null),containerRef=useRef<HTMLDivElement>(null);
  const loadRef=useRef<(allowDuringMutation?:boolean)=>Promise<void>>(async()=>{});
  sessionRef.current=sessionScope;
  const current=(session:ReadSession1098|null):session is ReadSession1098=>!!session&&session.active&&mounted.current&&sessionRef.current===session;
  const setConfirmation=(value:Confirmation|null)=>{confirmationRef.current=value;setConfirming(value)};
  const updateDraft=(session:ReadSession1098,next:HandoverDraft110)=>{
    if(!current(session))return;
    draftRef.current=next;saveHandoverDraft110(session,next);setDraft(next);
  };
  const load=async(allowDuringMutation=false)=>{
    const session=sessionRef.current;
    if(!current(session))return;
    if(mutatingRef.current&&!allowDuringMutation){queuedRefresh.current=true;return}
    const id=++loadId.current;
    refreshingRef.current=true;setRefreshing(true);
    const result=await reader.request(session,async()=>{
      if(!current(session))throw Error('A sessão foi encerrada.');
      const api=window.mopDesktop?.handover36;
      if(!api)throw Error('Canal de passagem indisponível. Abra o MOP pelo aplicativo.');
      return await api('snapshot') as BackendSnapshot;
    },{invalidate:true});
    if(!current(session)||id!==loadId.current||!reader.isCurrent(result))return;
    try{
      if(result.status==='error')throw result.error;
      if(result.status!=='ok')return;
      const next=normalize(result.value),nextSignature=signature(next);
      const reconciled=reconcileHandoverDraft110(next,draftRef.current||readHandoverDraft110(session));
      if(confirmationRef.current&&confirmationRef.current.signature!==nextSignature){
        setConfirmation(null);
        setReviewMessage('As informações mudaram durante a confirmação. Revise a passagem antes de confirmar novamente.');
      }else if(reconciled.message)setReviewMessage(reconciled.message);
      snapshotRef.current=next;reviewSignature.current=nextSignature;setSnapshot(next);updateDraft(session,reconciled.draft);
      staleRef.current=false;setStale(false);setLoadError('');setLastUpdated(new Date().toISOString());
    }catch(error){
      staleRef.current=true;setStale(true);setLoadError(messageOf(error,'Não foi possível atualizar a passagem. Seu rascunho foi preservado.'));
      if(confirmationRef.current)setConfirmation(null);
    }finally{
      if(current(session)&&id===loadId.current){refreshingRef.current=false;setRefreshing(false)}
    }
  };
  loadRef.current=load;

  useEffect(()=>{
    mounted.current=true;reader.setScope(sessionScope);
    snapshotRef.current=null;draftRef.current=sessionScope?readHandoverDraft110(sessionScope):undefined;
    reviewSignature.current='';staleRef.current=true;refreshingRef.current=false;mutatingRef.current=false;queuedRefresh.current=false;
    confirmationRef.current=null;setConfirming(null);setSnapshot(null);setDraft(draftRef.current);setStale(true);setRefreshing(false);setMutating(false);
    setLoadError('');setActionError('');setReviewMessage('');setSuccess(null);setLastUpdated(undefined);
    if(current(sessionScope))void loadRef.current();
    const timer=setInterval(()=>{if(current(sessionScope))void loadRef.current()},30000);
    const off=window.mopDesktop?.onSync?.(status=>{if(status?.dataChanged&&current(sessionScope))void loadRef.current()});
    return()=>{
      mounted.current=false;loadId.current++;commandId.current++;reader.clearScope(sessionScope);
      clearInterval(timer);off?.();
    };
  },[sessionScope,reader]);

  const refresh=()=>{
    if(mutatingRef.current)return;
    if(confirmationRef.current){setConfirmation(null);setReviewMessage('Atualize a conferência antes de confirmar a passagem.')}
    void loadRef.current();
  };
  const changeDraft=(next:HandoverDraft110)=>{
    const session=sessionRef.current;
    if(!current(session)||mutatingRef.current||confirmationRef.current||next.contextKey!==draftRef.current?.contextKey)return;
    if(!snapshotRef.current)return;
    const reconciled=reconcileHandoverDraft110(snapshotRef.current,next);
    updateDraft(session,reconciled.draft);
    if(reconciled.message)setReviewMessage(reconciled.message);
  };
  const assertReady=()=>{
    const session=sessionRef.current;
    if(!current(session))throw Error('A sessão foi encerrada. Entre novamente para continuar.');
    if(mutatingRef.current)throw Error('Aguarde a operação em andamento.');
    if(refreshingRef.current||staleRef.current||!snapshotRef.current)throw Error('Atualize a passagem antes de continuar.');
    return session;
  };
  const execute=async(command:HandoverCommand)=>{
    const session=assertReady(),id=++commandId.current;
    const api=window.mopDesktop?.handover36;
    if(!api)throw Error('Canal de passagem indisponível.');
    mutatingRef.current=true;setMutating(true);setActionError('');setSuccess(null);
    const action=command.kind==='prepareDelivery'?'deliver':command.kind==='confirmReceipt'?'receive':'assignPending';
    const input=command.kind==='prepareDelivery'?{summary:command.summary,reviewToken:command.reviewToken,checklist:command.checklist}:command.kind==='confirmReceipt'?{deliveryId:command.deliveryId,receiptNote:command.receiptNote,readVersions:command.readVersions}:{protocol:command.protocol,readVersion:command.readVersion,assignee:command.assignee,nextAction:command.nextAction};
    try{
      const result=await api(action,input) as CommandResult;
      if(!current(session)||id!==commandId.current)throw Error('A sessão foi alterada. O resultado pertence à sessão anterior.');
      if(!result||result.action!==action||!Number.isFinite(result.id))throw Error('O resultado da operação não pôde ser confirmado. Confira o estado atualizado antes de reenviar.');
      setConfirmation(null);
      const online=result.syncState==='online';
      const text=action==='deliver'
        ?'Entrega #'+result.id+(online?' registrada na central. Aguarde a conferência de outro operador.':' salva neste computador. A sincronização com a central ainda está pendente; o próximo operador deve aguardar essa confirmação.')
        :action==='receive'
        ?'Recebimento #'+result.id+(online?' confirmado na central. A passagem foi registrada.':' salvo neste computador. A sincronização com a central ainda está pendente.')
        :(result.changed===false?'A orientação já corresponde aos dados salvos.':online?'Orientação de continuidade salva na central.':'Orientação salva neste computador. A sincronização com a central ainda está pendente.');
      setSuccess({text,tone:online?'success':'warning'});setReviewMessage('');
      queuedRefresh.current=false;
      await loadRef.current(true);
    }catch(error){
      if(current(session)&&id===commandId.current){
        setConfirmation(null);setActionError(messageOf(error,'Não foi possível confirmar a operação. Confira o estado atualizado antes de tentar novamente.'));
        staleRef.current=true;setStale(true);queuedRefresh.current=false;
        await loadRef.current(true);
      }
      throw error;
    }finally{
      if(id===commandId.current){
        mutatingRef.current=false;
        if(current(session)){
          setMutating(false);
          if(queuedRefresh.current){queuedRefresh.current=false;void loadRef.current()}
        }
      }
    }
  };
  const command=async(value:HandoverCommand)=>{
    const session=assertReady(),latest=snapshotRef.current!;
    if(value.kind==='assignPending'){
      if(confirmationRef.current)throw Error('Conclua ou cancele a confirmação da passagem antes de editar a orientação.');
      const item=latest.items.find(row=>row.id===value.protocol);
      if(!item||!item.canEditContinuity||item.readVersion!==value.readVersion)throw Error('O registro mudou ou não permite esta edição. Atualize a passagem e revise a orientação.');
      await execute(value);return;
    }
    if(confirmationRef.current)return;
    if(value.kind==='prepareDelivery'&&(latest.stage!=='delivery'||value.reviewToken!==latest.reviewToken))throw Error('A entrega mudou. Atualize e revise a conferência.');
    if(value.kind==='confirmReceipt'&&(latest.stage!=='receipt'||value.deliveryId!==latest.deliveryId))throw Error('A entrega não está mais disponível para este recebimento.');
    triggerRef.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    setActionError('');setSuccess(null);setConfirmation({command:value,signature:reviewSignature.current,session});
  };
  const confirm=async()=>{
    const intent=confirmationRef.current;
    if(!intent||mutatingRef.current)return;
    if(!current(intent.session)||intent.signature!==reviewSignature.current||staleRef.current||refreshingRef.current){
      setConfirmation(null);setActionError('As informações da passagem mudaram. Atualize e confira antes de confirmar.');return;
    }
    try{await execute(intent.command)}catch{/* execute retains the operation error and refreshes the current state. */}
  };
  const delivery=confirming?.command.kind==='prepareDelivery';
  const error=actionError||loadError;
  return <div className="handover110-operational" ref={containerRef} tabIndex={-1}>
    {error&&<div className="handover110-feedback is-error" role="alert"><AlertTriangle size={18} aria-hidden="true"/><span>{error}{loadError&&actionError&&' '+loadError}</span></div>}
    {success&&<div className={'handover110-feedback is-'+success.tone} role="status"><CheckCircle2 size={18} aria-hidden="true"/><span>{success.text}</span></div>}
    {!snapshot&&<PageHeader page="handover" title="Passagem de Turno" description="Ocorrências, pendências e próximos passos para o plantão."/>}
    {!snapshot&&<div className="handover110-loading" role="status">
      {refreshing?<><LoaderCircle size={22} className="handover110-spin" aria-hidden="true"/><span>Carregando informações do turno…</span></>:<><AlertTriangle size={22} aria-hidden="true"/><span>Não foi possível carregar a passagem.</span><Button onClick={refresh} disabled={!sessionScope?.active}>Tentar novamente</Button></>}
    </div>}
    {snapshot&&<HandoverPage initial={snapshot} draft={draft} onDraftChange={changeDraft} mode="operational"
      disabled={mutating||!!confirming||!sessionScope?.active} refreshing={refreshing} stale={stale} lastUpdated={lastUpdated}
      onRefresh={refresh} reviewMessage={reviewMessage} onOpenRecord={onOpenRecord} onNavigateRoutines={onNavigateRoutines} onCommand={command}/>}
    <AlertDialog open={!!confirming} onOpenChange={open=>{if(!open&&!mutatingRef.current)setConfirmation(null)}}>
      <AlertDialogContent className="mop-shadcn-close handover110-dialog" overlayClassName="mop-shadcn-close-overlay"
        onEscapeKeyDown={event=>{event.stopPropagation();if(mutatingRef.current)event.preventDefault()}}
        onCloseAutoFocus={event=>{event.preventDefault();const target=triggerRef.current;if(target?.isConnected&&!target.hasAttribute('disabled'))target.focus();else containerRef.current?.focus()}}>
        <AlertDialogHeader>
          <span className="mop-shadcn-close-icon" aria-hidden="true"><ArrowLeftRight size={23}/></span>
          <AlertDialogTitle>{delivery?'Confirmar entrega do turno':'Confirmar recebimento do turno'}</AlertDialogTitle>
          <AlertDialogDescription>{delivery?'O resumo e as pendências serão entregues para conferência por outro operador.':'Você registrará o recebimento e a ciência das pendências críticas conferidas.'}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="handover110-dialog-notice"><ShieldCheck size={18} aria-hidden="true"/><span>Esta ação será registrada na auditoria. Confira o resumo e as orientações antes de confirmar.</span></div>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" disabled={mutating}>Cancelar</AlertDialogCancel>
          <AlertDialogAction type="button" className="handover110-dialog-confirm" disabled={mutating||refreshing||stale}
            onClick={event=>{event.preventDefault();void confirm()}}>{mutating?'Registrando…':delivery?'Confirmar entrega':'Confirmar recebimento'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
