import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, ArrowRight, CalendarDays, Check, CheckCircle2, ClipboardCheck, ClipboardList, Clock3, FileText, Info, ListChecks, LoaderCircle, Moon, PencilLine, Search, ShieldCheck, Sparkles, Sun, UserRound, X, ChevronDown, ExternalLink } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import './handover110.css';

export type HandoverStage = 'delivery'|'receipt'|'awaiting-receipt'|'pending'|'complete';
export type HandoverItem = {
  id:string; title:string; description:string; status:'Concluído'|'Em andamento'|'Pendente';
  category:string; occurredAt:string; priority:'Normal'|'Urgente'; critical:boolean;
  assignee:string; nextAction:string; readVersion:string; icon:LucideIcon;
  condo?:string; deadline?:string|null; actionTaken?:string; sourcePriority?:string; updatedAt?:string;
  overdue?:boolean; dueSoon?:boolean; stale?:boolean; missingAssignee?:boolean; missingNextAction?:boolean; canEditContinuity?:boolean;
};
export type HandoverSnapshot = {
  stage:HandoverStage; shift:'Diurno'|'Noturno'; date:string; period:string; outgoing:string; incoming:string|null;
  items:HandoverItem[]; deliverySummary:string; receiptNote:string; reviewToken?:string; deliveryId?:number;
  criticalConfirmations:Record<string,boolean>; shiftId?:string; updatedAt?:string; deliveredAt?:string|null;
  deliveredShift?:{id:string;type:string;date:string;period:string}|null; deliveredItems?:HandoverItem[];
  changes?:Array<{id:string;kind:'added'|'updated'|'resolved'|'unavailable';deliveredVersion?:string;currentVersion?:string}>;
  counts?:{open:number;critical:number;overdue:number;created:number;updated:number;soon:number;stale:number;missingAssignee?:number;missingNextAction?:number;continuityReady?:number;changedSinceDelivery?:number};
};
export type HandoverDraft110 = {
  contextKey:string; summary:string; receiptNote:string; deliveryChecks:Record<string,boolean>;
  reviewedVersions:Record<string,string>; reviewToken?:string; reviewContext?:string;
};
export type HandoverCommand =
  |{kind:'prepareDelivery';summary:string;reviewToken?:string;checklist:string[]}
  |{kind:'confirmReceipt';deliveryId:number;receiptNote:string;criticalProtocols:string[];readVersions:Record<string,string>}
  |{kind:'assignPending';protocol:string;readVersion:string;assignee:string;nextAction:string};
export interface HandoverAdapter { readonly mode:'demo'|'operational'; load():Promise<HandoverSnapshot>; execute(command:HandoverCommand):Promise<{ok:boolean;message:string}> }
export const demoSnapshot:HandoverSnapshot = {
  stage:'delivery',shift:'Diurno',date:'25/11/2026',period:'06:00 – 18:00',outgoing:'Operador Demo',incoming:null,
  deliverySummary:'',receiptNote:'',criticalConfirmations:{},items:[
    {id:'R-0141',title:'Verificação do backup de sistemas',description:'Cópia iniciada. A equipe aguarda a verificação final de integridade.',status:'Em andamento',category:'Sistemas',occurredAt:'25/11/2026, 13:47',priority:'Normal',critical:false,assignee:'Equipe de TI',nextAction:'Confirmar o término e registrar o resultado da verificação.',readVersion:'2',icon:Clock3,condo:'Condomínio demonstrativo',canEditContinuity:true},
    {id:'R-0138',title:'Falha no leitor da Portaria A',description:'Leitor de credenciais com falhas intermitentes. Acesso acompanhado pela equipe local.',status:'Pendente',category:'Infraestrutura',occurredAt:'25/11/2026, 10:22',priority:'Urgente',critical:true,assignee:'Equipe técnica',nextAction:'Testar o leitor após o ajuste e confirmar a normalização com a portaria.',readVersion:'3',icon:AlertTriangle,condo:'Condomínio demonstrativo',sourcePriority:'Urgente',canEditContinuity:true},
    {id:'R-0143',title:'Retorno de manutenção do CFTV',description:'Aguardando definição de quem acompanhará o retorno técnico.',status:'Pendente',category:'Manutenção',occurredAt:'25/11/2026, 14:20',priority:'Normal',critical:false,assignee:'',nextAction:'',readVersion:'1',icon:Clock3,condo:'Condomínio demonstrativo',missingAssignee:true,missingNextAction:true,canEditContinuity:true},
  ],
};
export const demoHandoverAdapter:HandoverAdapter = {mode:'demo',async load(){return {...demoSnapshot,items:demoSnapshot.items.map(item=>({...item}))}},async execute(){return {ok:false,message:'Demonstração: nenhuma passagem operacional foi registrada.'}}};
type Props = {
  initial?:HandoverSnapshot; onOpenRecord?:(id:string)=>void; onNavigateRoutines?:()=>void;
  onCommand?:(command:HandoverCommand)=>Promise<void>; mode?:'demo'|'operational';
  draft?:HandoverDraft110; onDraftChange?:(draft:HandoverDraft110)=>void;
  disabled?:boolean; refreshing?:boolean; stale?:boolean; lastUpdated?:string; onRefresh?:()=>void; reviewMessage?:string;
};
type View = 'all'|'critical'|'incomplete'|'overdue'|'deadlines';
type Edit = {id:string;readVersion:string;assignee:string;nextAction:string};
const checklist = [
  {key:'pending',title:'Pendências revisadas',description:'Conferi responsáveis e próximas ações dos registros em aberto.'},
  {key:'deadlines',title:'Riscos e prazos conferidos',description:'Revisei as pendências importantes, os vencimentos e os atrasos.'},
  {key:'continuity',title:'Continuidade orientada',description:'Registrei o que o próximo plantão precisa acompanhar.'},
];
const template = 'Situação geral do plantão:\n\nOcorrências e providências:\n\nOrientações para continuidade:\n';
const contextOf = (value:HandoverSnapshot)=>(value.shiftId||value.date+'|'+value.shift)+'|'+value.stage+'|'+(value.deliveryId||'');
const draftFor = (value:HandoverSnapshot):HandoverDraft110=>({contextKey:contextOf(value),summary:value.stage==='delivery'?'':value.deliverySummary||'',receiptNote:value.receiptNote||'',deliveryChecks:{},reviewedVersions:{},reviewToken:value.reviewToken});
const hasSummary = (value:string)=>!!value.replace(/^(Situação geral do plantão|Ocorrências e providências|Orientações para continuidade):\s*$/gmi,'').trim();
const fold = (value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const missingAssignee = (item:HandoverItem)=>item.missingAssignee??(!item.assignee?.trim()||item.assignee.trim()==='A definir');
const missingAction = (item:HandoverItem)=>item.missingNextAction??!item.nextAction?.trim();
const incomplete = (item:HandoverItem)=>missingAssignee(item)||missingAction(item);
function dateLabel(value?:string|null,withTime=true){
  if(!value)return 'Não informado';
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value.split('-').reverse().join('/');
  if(!/^\d{4}-\d{2}-\d{2}T/.test(value))return value;
  const date=new Date(value);if(!Number.isFinite(+date))return value;
  return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit'}:{})}).format(date);
}
const changeNames = {added:'Incluída após a entrega',updated:'Atualizada após a entrega',resolved:'Resolvida após a entrega',unavailable:'Não disponível no escopo atual'};

export default function HandoverPage({initial=demoSnapshot,onOpenRecord,onNavigateRoutines,onCommand,mode='demo',draft:controlledDraft,onDraftChange,disabled=false,refreshing=false,stale=false,lastUpdated,onRefresh,reviewMessage}:Props){
  const snapshot=initial,isDemo=mode==='demo',receipt=snapshot.stage==='receipt',waiting=snapshot.stage==='awaiting-receipt',delivery=snapshot.stage==='delivery';
  const queueRef=useRef<HTMLElement|null>(null);
  const [localDraft,setLocalDraft]=useState(()=>draftFor(snapshot));
  const draft=controlledDraft||localDraft;
  const [view,setView]=useState<View>('all'),[query,setQuery]=useState(''),[expanded,setExpanded]=useState<string|null>(null);
  const [editing,setEditing]=useState<Edit|null>(null),[saving,setSaving]=useState(false),[editError,setEditError]=useState(''),[message,setMessage]=useState('');
  const changeDraft=(patch:Partial<HandoverDraft110>)=>{const next={...draft,...patch};if(onDraftChange)onDraftChange(next);else setLocalDraft(next)};
  const context=contextOf(snapshot);
  useEffect(()=>{setEditing(null);setEditError('');setMessage('');setExpanded(null);if(!controlledDraft)setLocalDraft(draftFor(snapshot))},[context]);
  const pending=useMemo(()=>snapshot.items.filter(item=>item.status!=='Concluído'),[snapshot.items]);
  const critical=pending.filter(item=>item.critical),overdue=pending.filter(item=>item.overdue),gaps=pending.filter(incomplete);
  const due=pending.filter(item=>item.deadline),unread=critical.filter(item=>draft.reviewedVersions[item.id]!==item.readVersion);
  const reviewed=critical.length-unread.length,checkCount=checklist.filter(item=>draft.deliveryChecks[item.key]).length;
  const summaryReady=hasSummary(draft.summary),readyCount=checkCount+(summaryReady?1:0);
  const editingCurrent=editing?pending.find(item=>item.id===editing.id):null;
  const editChanged=!!editing&&(editing.assignee!==(editingCurrent?.assignee||'')||editing.nextAction!==(editingCurrent?.nextAction||''));
  const staleEdit=!!editing&&(!editingCurrent||editingCurrent.readVersion!==editing.readVersion);
  const working=disabled||refreshing||saving||stale;
  const canDeliver=delivery&&!working&&summaryReady&&checkCount===3&&!editChanged;
  const canReceive=receipt&&!working&&!!snapshot.deliveryId&&!unread.length&&!editChanged;
  const visible=useMemo(()=>{
    const needle=fold(query.trim());
    return pending.filter(item=>(view==='all'||view==='critical'&&item.critical||view==='incomplete'&&incomplete(item)||view==='overdue'&&item.overdue||view==='deadlines'&&!!item.deadline)&&(!needle||fold([item.id,item.title,item.description,item.condo,item.category,item.assignee,item.nextAction].filter(Boolean).join(' ')).includes(needle)));
  },[pending,view,query]);
  const counts:Record<View,number>={all:pending.length,critical:critical.length,incomplete:gaps.length,overdue:overdue.length,deadlines:due.length};
  const phase=receipt?'Conferência para recebimento':waiting?'Entrega registrada':delivery?'Preparação da entrega':'Continuidade do plantão';
  const submit=async()=>{
    setMessage('');
    if(isDemo){setMessage('Demonstração: nenhuma entrega, leitura ou recebimento foi registrado.');return}
    if(!onCommand){setMessage('O canal operacional está indisponível. Atualize a passagem.');return}
    try{
      if(canDeliver)await onCommand({kind:'prepareDelivery',summary:draft.summary.trim(),reviewToken:snapshot.reviewToken,checklist:checklist.filter(item=>draft.deliveryChecks[item.key]).map(item=>item.key)});
      else if(canReceive)await onCommand({kind:'confirmReceipt',deliveryId:snapshot.deliveryId!,receiptNote:draft.receiptNote.trim(),criticalProtocols:critical.map(item=>item.id),readVersions:Object.fromEntries(critical.map(item=>[item.id,draft.reviewedVersions[item.id]]))});
    }catch(error){setMessage(error instanceof Error?error.message:'Não foi possível preparar a confirmação.')}
  };
  const saveContinuity=async()=>{
    if(!editing||working||staleEdit)return;
    setEditError('');
    if(isDemo){setEditError('Demonstração: orientações não são gravadas na operação.');return}
    if(!onCommand){setEditError('Canal operacional indisponível.');return}
    setSaving(true);
    try{await onCommand({kind:'assignPending',protocol:editing.id,readVersion:editing.readVersion,assignee:editing.assignee.trim(),nextAction:editing.nextAction.trim()});setEditing(null)}
    catch(error){setEditError(error instanceof Error?error.message:'Não foi possível salvar a orientação. Seus campos foram mantidos.')}
    finally{setSaving(false)}
  };
  const scrollToQueue=()=>{
    const queue=queueRef.current,pane=queue?.closest<HTMLElement>('.ref-main');
    if(!queue||!pane)return;
    // Scroll only the content pane: scrollIntoView also moved the shell and hid its titlebar.
    const inset=parseFloat(getComputedStyle(pane).paddingTop)||0;
    const top=pane.scrollTop+queue.getBoundingClientRect().top-pane.getBoundingClientRect().top-pane.clientTop-inset;
    pane.scrollTo({top:Math.max(0,top),behavior:'auto'});
  };
  const showFilter=(next:View)=>{setView(next);setQuery('');scrollToQueue()};
  const deliveryBlock=stale?'Atualize os dados para concluir a conferência.':editChanged?'Salve ou cancele a orientação em edição.':!summaryReady?'Escreva um resumo com orientações para o próximo plantão.':checkCount<3?'Conclua os três itens de conferência.':working?'Aguarde a operação em andamento.':'Tudo conferido. Revise os dados na confirmação final.';
  const receiptBlock=stale?'Atualize os dados antes de confirmar o recebimento.':editChanged?'Salve ou cancele a orientação em edição.':unread.length?unread.length+' pendência(s) importante(s) ainda precisam de leitura.':working?'Aguarde a operação em andamento.':'Leituras conferidas. Registre eventuais ressalvas antes de confirmar.';
  return <section className="handover110" aria-labelledby="handover110-title">
    <header className="handover110-heading">
      <span className="handover110-heading-icon" aria-hidden="true"><ArrowLeftRight size={26}/></span>
      <div><span className="handover110-eyebrow">CONTINUIDADE OPERACIONAL</span><h1 id="handover110-title">Passagem de Turno</h1><p>Deixe claro o que aconteceu, o que continua aberto e qual é o próximo passo.</p></div>
      <span className={'handover110-phase '+(waiting?'is-waiting':receipt?'is-receipt':'')}><span/>{isDemo?'Demonstração · ':''}{phase}</span>
    </header>
    {onRefresh&&<div className="handover110-connection" aria-label="Atualização dos dados da passagem"><span>{stale?<AlertTriangle size={16}/>:refreshing?<LoaderCircle size={16} className="handover110-spin"/>:<CheckCircle2 size={16}/>}<span>{stale?'Dados precisam ser atualizados':refreshing?'Atualizando a passagem…':lastUpdated?'Dados atualizados em '+dateLabel(lastUpdated):'Dados da passagem atual'}</span></span><Button type="button" variant="ghost" disabled={disabled||refreshing||saving} onClick={onRefresh}><Clock3 size={14}/>Atualizar dados</Button></div>}
    <section className="handover110-context" aria-label="Contexto do plantão">
      <div className="handover110-shift">{snapshot.shift==='Noturno'?<Moon size={23}/>:<Sun size={23}/>}<div><span>Plantão atual</span><strong>{snapshot.shift} <small>{snapshot.period}</small></strong><p><CalendarDays size={13}/>{dateLabel(snapshot.date,false)}</p></div></div>
      <div className="handover110-people"><div><span>Quem entrega</span><strong><UserRound size={15}/>{snapshot.outgoing||'Não informado'}</strong></div><ArrowRight className="handover110-flow-arrow" size={19}/><div><span>Quem recebe</span><strong><UserRound size={15}/>{snapshot.incoming||'Aguardando confirmação'}</strong></div></div>
      {snapshot.deliveredAt&&<div className="handover110-delivered"><span>Entrega #{snapshot.deliveryId}</span><strong>{dateLabel(snapshot.deliveredAt)}</strong><small>{snapshot.deliveredShift?snapshot.deliveredShift.type+' · '+snapshot.deliveredShift.period:'Conferência pelo próximo operador'}</small></div>}
    </section>
    <div className="handover110-metrics" aria-label="Indicadores da passagem">
      {([{view:'all',value:pending.length,label:'Pendências abertas',icon:ClipboardList},{view:'critical',value:critical.length,label:'Exigem leitura',icon:ShieldCheck},{view:'overdue',value:overdue.length,label:'Prazos vencidos',icon:Clock3},{view:'incomplete',value:gaps.length,label:'Orientação incompleta',icon:UserRound}] as const).map(metric=><button key={metric.view} type="button" className={'handover110-metric '+(metric.view!=='all'&&metric.value?'attention':'')} onClick={()=>showFilter(metric.view)}><metric.icon size={19}/><strong>{metric.value}</strong><span>{metric.label}</span><ArrowRight size={14}/></button>)}
    </div>
    {reviewMessage&&<div className="handover110-review-message" role="status"><Info size={18}/><p>{reviewMessage}</p></div>}
    {!!snapshot.changes?.length&&<details className="handover110-changes"><summary><Info size={17}/><span><strong>{snapshot.changes.length} alteração(ões) desde a entrega</strong> · confira o estado atual das pendências</span><ChevronDown size={16}/></summary><ul>{snapshot.changes.map(change=><li key={change.id}><strong>{change.id}</strong><span>{changeNames[change.kind]}</span></li>)}</ul></details>}
    <div className="handover110-layout">
      <div className="handover110-main">
        <section ref={queueRef} className="handover110-panel handover110-queue" id="handover110-queue" aria-labelledby="handover110-queue-title">
          <header className="handover110-panel-header"><div><span className="handover110-panel-icon"><ClipboardList size={21}/></span><div><h2 id="handover110-queue-title">Pendências para continuidade</h2><p>Dados atuais dos registros. Priorize os riscos e deixe a próxima ação clara.</p></div></div><span className="handover110-count">{pending.length} aberta(s)</span></header>
          <div className="handover110-toolbar"><label className="handover110-search"><Search size={17} aria-hidden="true"/><input aria-label="Buscar pendência" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Protocolo, assunto, condomínio ou responsável"/>{query&&<button type="button" aria-label="Limpar busca" onClick={()=>setQuery('')}><X size={15}/></button>}</label>
            <div className="handover110-filters" role="group" aria-label="Filtrar pendências">{([{key:'all',label:'Todas'},{key:'critical',label:'Críticas'},{key:'incomplete',label:'Sem orientação'},{key:'overdue',label:'Vencidas'},{key:'deadlines',label:'Prazos'}] as const).map(option=><button type="button" key={option.key} aria-pressed={view===option.key} onClick={()=>setView(option.key)}>{option.label}<span>{counts[option.key]}</span></button>)}</div>
          </div>
          <div className="handover110-list-status"><span>{visible.length} de {pending.length} pendência(s)</span>{receipt&&critical.length>0&&<span><ShieldCheck size={13}/>{reviewed} de {critical.length} leituras confirmadas</span>}</div>
          <div className="handover110-items">
            {visible.map(item=>{
              const open=expanded===item.id,editingThis=editing?.id===item.id,read=draft.reviewedVersions[item.id]===item.readVersion;
              return <article className={'handover110-item '+(item.critical?'is-critical ':'')+(open?'is-open':'')} key={item.id}>
                <button type="button" className="handover110-item-toggle" aria-expanded={open} aria-controls={'handover110-details-'+item.id} onClick={()=>setExpanded(open?null:item.id)}>
                  <span className={'handover110-item-symbol '+(read&&receipt?'is-reviewed':'')}>{read&&receipt?<Check size={19}/>:item.critical?<AlertTriangle size={19}/>:<FileText size={19}/>}</span>
                  <span className="handover110-item-copy"><span className="handover110-item-meta"><b>{item.id}</b><span>{item.condo||item.category}</span></span><strong>{item.title}</strong><span className="handover110-item-caption">{item.assignee?.trim()&&!missingAssignee(item)?item.assignee:'Responsável não informado'}{item.deadline?' · Prazo '+dateLabel(item.deadline):''}</span></span>
                  <span className="handover110-item-badges">{item.critical&&<span className="handover110-badge is-critical">Leitura obrigatória</span>}{item.overdue?<span className="handover110-badge is-overdue">Vencida</span>:item.dueSoon?<span className="handover110-badge is-soon">Próximas 12h</span>:<span className="handover110-badge">{item.status}</span>}{incomplete(item)&&<span className="handover110-badge is-gap">Completar orientação</span>}</span>
                  <ChevronDown className="handover110-item-chevron" size={17}/>
                </button>
                {open&&<div className="handover110-item-details" id={'handover110-details-'+item.id}>
                  <p className="handover110-description">{item.description||'Sem descrição adicional neste registro.'}</p>
                  {item.actionTaken&&<div className="handover110-taken"><span>Providências já tomadas</span><p>{item.actionTaken}</p></div>}
                  <dl className="handover110-item-facts"><div><dt>Prioridade</dt><dd>{item.sourcePriority||item.priority}</dd></div><div><dt>Última atualização</dt><dd>{dateLabel(item.updatedAt||item.occurredAt)}</dd></div><div><dt>Prazo</dt><dd className={item.overdue?'is-overdue':''}>{item.deadline?dateLabel(item.deadline):'Sem prazo definido'}</dd></div></dl>
                  {editingThis?<div className="handover110-editor" aria-label={'Editar orientação de '+item.id}>
                    <label>Responsável pelo acompanhamento<input aria-label="Responsável pelo acompanhamento" maxLength={160} value={editing.assignee} onChange={event=>setEditing({...editing,assignee:event.target.value})} disabled={disabled||saving} placeholder="Pessoa ou equipe responsável"/></label>
                    <label>Próxima ação<textarea aria-label="Próxima ação" maxLength={1000} rows={3} value={editing.nextAction} onChange={event=>setEditing({...editing,nextAction:event.target.value})} disabled={disabled||saving} placeholder="O que deve ser feito, quando e com quem acompanhar"/></label>
                    <small>Deixar um campo vazio remove a informação correspondente do registro.</small>
                    {staleEdit&&<p className="handover110-inline-error" role="alert">Este registro mudou durante a edição. Cancele a edição, confira os dados atuais e revise sua orientação antes de salvar.</p>}
                    {editError&&<p className="handover110-inline-error" role="alert">{editError}</p>}
                    <div className="handover110-editor-actions"><Button type="button" variant="outline" disabled={saving} onClick={()=>{setEditing(null);setEditError('')}}>Cancelar edição</Button><Button type="button" className="handover110-primary" disabled={working||staleEdit||!editChanged} onClick={()=>void saveContinuity()}>{saving?<LoaderCircle className="handover110-spin" size={16}/>:<Check size={16}/>}Salvar orientação</Button></div>
                  </div>:<div className="handover110-continuity"><div className={missingAssignee(item)?'is-missing':''}><span><UserRound size={14}/>Responsável</span><strong>{missingAssignee(item)?'Não informado':item.assignee}</strong></div><div className={missingAction(item)?'is-missing':''}><span><ArrowRight size={14}/>Próxima ação</span><p>{missingAction(item)?'Defina o próximo passo para orientar o plantão seguinte.':item.nextAction}</p></div></div>}
                  <div className="handover110-item-actions">
                    {!editingThis&&item.canEditContinuity&&<Button type="button" variant="outline" disabled={working||editChanged} onClick={()=>{setEditing({id:item.id,readVersion:item.readVersion,assignee:item.assignee||'',nextAction:item.nextAction||''});setEditError('')}}><PencilLine size={15}/>Editar orientação</Button>}
                    {onOpenRecord&&<Button type="button" variant="ghost" disabled={working||editChanged} onClick={()=>onOpenRecord(item.id)}><ExternalLink size={15}/>Abrir registro</Button>}
                    {!item.canEditContinuity&&!isDemo&&<small>A orientação pode ser editada pelo autor ou pela supervisão.</small>}
                  </div>
                  {receipt&&item.critical&&<label className={'handover110-reading '+(read?'is-checked':'')}><input type="checkbox" checked={read} disabled={working||editChanged} onChange={event=>{const versions={...draft.reviewedVersions};if(event.target.checked)versions[item.id]=item.readVersion;else delete versions[item.id];changeDraft({reviewedVersions:versions})}}/><ShieldCheck size={18}/><span><strong>Li e compreendi esta pendência</strong><small>A ciência será vinculada à versão atual deste registro.</small></span></label>}
                </div>}
              </article>;
            })}
            {!visible.length&&<div className="handover110-empty">{pending.length?<Search size={28}/>:<CheckCircle2 size={30}/>}<strong>{pending.length?'Nenhuma pendência encontrada':'Sem pendências abertas'}</strong><p>{pending.length?'Ajuste a busca ou o filtro para localizar outros registros.':'Registre no resumo o que o próximo plantão precisa saber.'}</p>{pending.length>0&&<Button type="button" variant="ghost" onClick={()=>{setView('all');setQuery('')}}>Limpar filtros</Button>}</div>}
          </div>
          {snapshot.counts&&<footer className="handover110-activity"><Clock3 size={14}/><span>No plantão atual: <strong>{snapshot.counts.created}</strong> registro(s) criado(s) · <strong>{snapshot.counts.updated}</strong> com eventos de atualização.</span></footer>}
        </section>
        <section className="handover110-panel handover110-summary" aria-labelledby="handover110-summary-title">
          <header className="handover110-panel-header"><div><span className="handover110-panel-icon"><FileText size={21}/></span><div><h2 id="handover110-summary-title">{receipt?'Resumo entregue pelo plantão anterior':waiting?'Resumo enviado ao próximo plantão':'Resumo para o próximo plantão'}</h2><p>{receipt||waiting?'Orientações registradas no momento da entrega.':'Explique o contexto e destaque o que merece acompanhamento.'}</p></div></div></header>
          {delivery?<div className="handover110-summary-body"><div className="handover110-summary-guide"><Sparkles size={16}/><p>Situação geral, providências tomadas e orientações para continuidade.</p>{!draft.summary.trim()&&<Button type="button" variant="ghost" disabled={working} onClick={()=>changeDraft({summary:template})}>Usar roteiro</Button>}</div><label className="handover110-sr-only" htmlFor="handover110-summary-input">Resumo para o próximo plantão</label><textarea id="handover110-summary-input" aria-label="Resumo para o próximo plantão" maxLength={1000} rows={6} value={draft.summary} onChange={event=>changeDraft({summary:event.target.value})} disabled={disabled||saving} placeholder="O que aconteceu no plantão? Quais providências foram tomadas? O que o próximo operador deve acompanhar?"/><div className="handover110-field-foot"><span><Info size={13}/>Rascunho até confirmar a entrega.</span><span>{draft.summary.length} / 1000</span></div></div>:<div className="handover110-summary-body"><div className="handover110-delivery-note">{snapshot.deliverySummary||'Esta entrega não contém um resumo textual.'}</div>{receipt&&<><label className="handover110-label" htmlFor="handover110-receipt-note">Ressalvas no recebimento <span>opcional</span></label><textarea id="handover110-receipt-note" aria-label="Ressalvas no recebimento" maxLength={1500} rows={4} value={draft.receiptNote} onChange={event=>changeDraft({receiptNote:event.target.value})} disabled={disabled||saving} placeholder="Registre divergências, informações que precisam de confirmação ou observações sobre o recebimento."/><div className="handover110-field-foot"><span>As ressalvas acompanham o recebimento.</span><span>{draft.receiptNote.length} / 1500</span></div></>}</div>}
          {!!snapshot.deliveredItems?.length&&<details className="handover110-delivered-records"><summary><ClipboardList size={16}/>Registros no momento da entrega <span>{snapshot.deliveredItems.length}</span><ChevronDown size={15}/></summary><p>Referência preservada da entrega. A conferência acima utiliza os dados atuais.</p>{snapshot.deliveredItems.map(item=><div key={item.id}><strong>{item.id} · {item.title}</strong><span>Responsável: {item.assignee||'Não informado'}</span><p>Próxima ação: {item.nextAction||'Não informada'}</p></div>)}</details>}
        </section>
      </div>
      <aside className="handover110-aside" aria-label="Conferência e confirmação">
        <section className="handover110-panel handover110-review">
          <header className="handover110-panel-header"><div><span className="handover110-panel-icon"><ClipboardCheck size={21}/></span><div><h2>{receipt?'Conferência do recebimento':waiting?'Aguardando recebimento':'Conferência da entrega'}</h2><p>{receipt?'Assuma o plantão com ciência das prioridades.':waiting?'A entrega será concluída com o aceite de outra conta.':'Uma revisão clara antes de passar o plantão.'}</p></div></div></header>
          <div className="handover110-review-body">
            {delivery&&<><div className="handover110-readiness"><div><span>Requisitos conferidos</span><strong>{readyCount} de 4</strong></div><progress value={readyCount} max={4} aria-label="Requisitos da entrega conferidos"/></div><div className={'handover110-summary-check '+(summaryReady?'is-ready':'')}><CheckCircle2 size={18}/><div><strong>Resumo para continuidade</strong><span>{summaryReady?'Orientação preenchida.':'Preencha o resumo do plantão.'}</span></div></div><div className="handover110-checklist">{checklist.map(item=><label className={draft.deliveryChecks[item.key]?'is-checked':''} key={item.key}><input type="checkbox" checked={!!draft.deliveryChecks[item.key]} disabled={working||editChanged} onChange={event=>changeDraft({deliveryChecks:{...draft.deliveryChecks,[item.key]:event.target.checked}})}/><span><strong>{item.title}</strong><small>{item.description}</small></span></label>)}</div>
              {gaps.length>0&&<div className="handover110-quality-note"><AlertTriangle size={17}/><div><strong>{gaps.length} pendência(s) com orientação incompleta</strong><p>Confira os responsáveis e próximos passos. Se algo ainda não estiver definido, explique no resumo.</p><button type="button" onClick={()=>showFilter('incomplete')}>Revisar orientações <ArrowRight size={13}/></button></div></div>}
              <Button type="button" className="handover110-primary handover110-submit" disabled={!canDeliver} onClick={()=>void submit()}><ArrowRight size={18}/>Registrar entrega do turno</Button><p className="handover110-action-help" role="status">{deliveryBlock}</p>
            </>}
            {receipt&&<><div className="handover110-readiness"><div><span>Leituras obrigatórias</span><strong>{reviewed} de {critical.length}</strong></div><progress value={critical.length?reviewed:1} max={critical.length||1} aria-label="Leituras obrigatórias conferidas"/></div><p className="handover110-review-explanation">{critical.length?'Abra cada pendência importante, confira a orientação e registre sua leitura.':'Não há pendências classificadas para leitura obrigatória. Confira o resumo e registre ressalvas, se necessário.'}</p>{unread.length>0&&<div className="handover110-unread">{unread.map(item=><button type="button" key={item.id} onClick={()=>{setView('critical');setQuery('');setExpanded(item.id);scrollToQueue()}}><span/><span>{item.id}<strong>{item.title}</strong></span><ArrowRight size={14}/></button>)}</div>}<Button type="button" className="handover110-primary handover110-submit" disabled={!canReceive} onClick={()=>void submit()}><ShieldCheck size={18}/>Confirmar recebimento</Button><p className="handover110-action-help" role="status">{receiptBlock}</p></>}
            {waiting&&<div className="handover110-waiting"><Clock3 size={32}/><strong>Entrega #{snapshot.deliveryId} registrada</strong><p>Outro operador deverá conferir o resumo, as pendências e confirmar o recebimento com a própria conta.</p><span>O estado atual dos registros continua disponível para acompanhamento.</span></div>}
            {!delivery&&!receipt&&!waiting&&<p className="handover110-review-explanation">Consulte as informações da passagem e atualize os dados para acompanhar a próxima etapa.</p>}
            {message&&<p className="handover110-local-message" role="status">{message}</p>}
            {isDemo&&<p className="handover110-demo-note">Modo de demonstração. As ações desta tela não registram uma passagem operacional.</p>}
          </div>
        </section>
        <section className="handover110-assist"><div><ListChecks size={19}/><h3>Antes de encerrar o plantão</h3></div><p>Confira também as rotinas previstas e registre qualquer execução pendente nas orientações da passagem.</p>{onNavigateRoutines&&<Button type="button" variant="ghost" disabled={working||editChanged} onClick={onNavigateRoutines}>Abrir Checklist e Rotinas <ArrowRight size={15}/></Button>}<div className="handover110-audit-note"><ShieldCheck size={15}/><span>A entrega e o recebimento ficam associados às contas dos operadores e ao histórico da operação.</span></div></section>
      </aside>
    </div>
  </section>;
}
