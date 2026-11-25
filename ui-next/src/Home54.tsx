import React,{useEffect,useRef,useState} from 'react';
import {AlertTriangle,ArrowRight,ArrowLeftRight,CalendarDays,CheckCircle2,ClipboardCheck,Clock3,FilePlus2,FileText,Flag,History,LayoutDashboard,ShieldCheck,Sun,Moon,RefreshCw,AlertCircle,RotateCw} from 'lucide-react';
import type {OperationalRecord} from './RecordsPage';
import OverviewCharts1097 from './components/analytics1097/OverviewCharts1097';
import { createReadSession1098, type ReadSession1098 } from './queries1098/readCoordinator1098';
import { useHomeRoutines1098 } from './queries1098/useHomeRoutines1098';
import './home109.css';import './home54.css';import './home56.css';import './home57.css';import './home58.css';import './home59.css';import './home60.css';import './home62.css';import './home63.css';import './home64.css';import './home65.css';

type ContinuityItem={id:string;title:string;status:string;assignee?:string;nextAction?:string;occurredAt?:string;priority?:string;critical?:boolean};
type ContinuitySnapshot={stage:string;deliveryId?:number;outgoing?:string;items:ContinuityItem[]};
type Props={records:OperationalRecord[];demo:boolean;operator:string;role:string;loading?:boolean;error?:string;onNavigate:(tab:string)=>void;onOpenRecord:(id:string)=>void;onNewRecord:()=>void;onRefresh:()=>void;accepted:boolean;lastUpdated?:Date|null;sessionScope?:ReadSession1098|null};
const dateFormat=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Sao_Paulo'});
const clockFormat=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'});
const dayFormat=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Sao_Paulo'});
function safeTime(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?'Horário não disponível':clockFormat.format(d)}
function ageLabel(value:string,now:Date){const minutes=Math.max(0,Math.floor((now.getTime()-new Date(value).getTime())/60000));if(!Number.isFinite(minutes))return 'Tempo indisponível';if(minutes<60)return 'Há '+minutes+' min';const hours=Math.floor(minutes/60);if(hours<24)return 'Há '+hours+' h';return 'Há '+Math.floor(hours/24)+' d'}
function dayGreeting(){const hour=Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hourCycle:'h23',timeZone:'America/Sao_Paulo'}).format(new Date()));return hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite'}
export default function Home54({records,demo,operator,role,loading,error,onNavigate,onOpenRecord,onNewRecord,onRefresh,accepted,lastUpdated,sessionScope}:Props){
 const fallbackSession=React.useMemo(()=>createReadSession1098({username:operator,role}),[operator,role]);
 const routineSession=sessionScope===undefined?fallbackSession:sessionScope;
 const [continuity,setContinuity]=useState<ContinuitySnapshot|null>(null);const [continuityError,setContinuityError]=useState('');const [continuityBusy,setContinuityBusy]=useState(false);
 useEffect(()=>{if(demo||role==='viewer'||!accepted||!routineSession?.active||!window.mopDesktop?.handover36){setContinuity(null);setContinuityBusy(false);setContinuityError('');return}let cancelled=false;setContinuityBusy(true);void window.mopDesktop.handover36('snapshot').then((raw:unknown)=>{if(cancelled||!routineSession.active)return;const value=raw as ContinuitySnapshot;setContinuity(value);setContinuityError('')}).catch((err:unknown)=>{if(cancelled||!routineSession.active)return;setContinuity(null);setContinuityError(err instanceof Error?err.message:'Consulta indisponível')}).finally(()=>{if(!cancelled&&routineSession.active)setContinuityBusy(false)});return()=>{cancelled=true}},[demo,accepted,lastUpdated,role,routineSession]);
 const {data:routineData,error:routineError,busy:routineBusy,refresh:refreshRoutines}=useHomeRoutines1098(!demo&&role!=='viewer'&&accepted,routineSession);
 const refreshHome=React.useCallback(()=>{onRefresh();void refreshRoutines()},[onRefresh,refreshRoutines]);
 const canCreate=['admin','supervisor','operator'].includes(role);
 const [newPendingNotice,setNewPendingNotice]=useState(0);
 const priorPendingIds=useRef<Set<string>|null>(null);
 useEffect(()=>{if(demo||loading||error)return;const current=new Set(records.filter(r=>r.status==='Pendente').map(r=>r.id));if(priorPendingIds.current){let added=0;for(const id of current){if(!priorPendingIds.current.has(id))added++}if(added>0)setNewPendingNotice(n=>n+added)}priorPendingIds.current=current},[records,demo,loading,error]);
 useEffect(()=>{const handle=(event:KeyboardEvent)=>{if(!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.repeat)return;const target=event.target as HTMLElement|null;if(target?.closest('input,textarea,select,[contenteditable="true"]'))return;const key=event.key.toLowerCase();if(key==='n'&&canCreate){event.preventDefault();onNewRecord()}else if(key==='p'){event.preventDefault();onNavigate('Passagem de Turno')}else if(key==='r'){event.preventDefault();refreshHome()}};window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle)},[canCreate,onNewRecord,onNavigate,refreshHome]);
 const stale=!!lastUpdated&&Date.now()-lastUpdated.getTime()>180000;
 const [eventFilter,setEventFilter]=useState<'Todos'|'Pendentes'|'Em andamento'>('Todos');const [now,setNow]=useState(()=>new Date());useEffect(()=>{const id=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(id)},[]);
 const hour=Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hourCycle:'h23',timeZone:'America/Sao_Paulo'}).format(now));
 const isDay=hour>=6&&hour<18;
 const scheduleEstimate=isDay?'06:00–18:00':'18:00–06:00';
 const pending=records.filter(r=>r.status==='Pendente'),ongoing=records.filter(r=>r.status==='Em andamento');
 const active=[...pending,...ongoing].sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt));
 const latest=[...records].filter(r=>eventFilter==='Todos'||r.status===(eventFilter==='Pendentes'?'Pendente':'Em andamento')).sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt)).slice(0,4);
 const today=dayFormat.format(now),todayRecords=records.filter(r=>{const d=new Date(r.occurredAt);return !Number.isNaN(d.getTime())&&dayFormat.format(d)===today});
 const completed=records.filter(r=>r.status==='Concluído');
 const management=role==='admin'||role==='supervisor';
 const ranked=[...active].sort((a,b)=>{const rank=(r:OperationalRecord)=>(r.category==='Segurança'?3:0)+(r.status==='Pendente'?2:0);return rank(b)-rank(a)||Date.parse(a.occurredAt)-Date.parse(b.occurredAt)});
 const focus=ranked.slice(0,3);
 // Operational clock is a local-time display; use the absolute last 12 hours window only for read-only context.
 // No claim that these records were created in the exact assigned shift.
 const recentWindow=records.filter(r=>{const t=Date.parse(r.occurredAt);return Number.isFinite(t)&&t<=now.getTime()&&now.getTime()-t<=12*3600000});
 const recentOpen=recentWindow.filter(r=>r.status!=='Concluído').length;
 const nextTasks=(routineData?.tasks||[]).filter(t=>!t.done).sort((a,b)=>String(a.reminder_time||'99:99').localeCompare(String(b.reminder_time||'99:99'))).slice(0,4);
 const urgent=active.filter(r=>/cr[ií]tic|urgent|emerg/i.test(r.priority||'')||r.status==='Pendente'&&r.category==='Segurança').slice(0,4);
 const overdue=active.filter(r=>{const time=Date.parse(r.occurredAt);return Number.isFinite(time)&&now.getTime()-time>=24*3600000}).slice(0,5);


 return <div className="mop-home54" aria-label="Central do operador">
  <div className="mop-home54-heading"><div className="mop-home54-titleicon"><LayoutDashboard size={23}/></div><div className="mop-home54-heading-copy"><h1>Início</h1><p>{management?'Central operacional · Visão administrativa':'Central do Operador · Resumo operacional do plantão'}</p></div></div>
  <section className="mop-home54-hero mop-home64-hero" aria-label="Boas-vindas e acesso rápido">
   <div className="mop-home64-hero-main">
    <div className="mop-home64-eyebrow"><span className="mop-home64-eyebrow-dot"/> CENTRAL OPERACIONAL <span className="mop-home64-eyebrow-rule"/></div>
    <h2>{dayGreeting()}, <em>{operator||'Operador'}!</em></h2>
    <p>{management?'Acompanhe os registros e mantenha a continuidade da operação.':'Acompanhe os acontecimentos, identifique pendências e organize seu plantão.'}</p>
    <div className="mop-home54-chips mop-home64-chips"><span>{isDay?<Sun size={16}/>:<Moon size={16}/>} Período {isDay?'diurno':'noturno'}</span><span><CalendarDays size={16}/>{dateFormat.format(now)}</span><span><Clock3 size={16}/>Escala prevista: {scheduleEstimate}</span></div>
    <small>{demo?'Demonstração: registros fictícios.':'Horário estimado pelo período atual, não pela escala cadastrada.'}</small>
   </div>
   <div className="mop-home64-hero-side">
    <div className="mop-home64-context"><span>SEU PLANTÃO</span><div><ShieldCheck size={20}/><strong>{accepted?'Ciência registrada':'Acompanhamento operacional'}</strong></div><p>{accepted?'Acompanhe as ocorrências e as pendências do período.':'Consulte a Passagem de Turno para informações oficiais.'}</p></div>
    <div className="mop-home64-action-heading"><strong>Acesso rápido</strong><span>Ações do plantão</span></div>
    <div className="mop-home55-top-actions" aria-label="Acesso rápido">{canCreate&&<button className="primary" type="button" onClick={onNewRecord} title="Criar ocorrência"><FilePlus2 size={17}/><span>Novo registro</span></button>}<button type="button" onClick={()=>onNavigate('Passagem de Turno')} title="Consultar passagem de turno"><ArrowLeftRight size={17}/><span>Passagem</span></button><button type="button" onClick={()=>onNavigate('Checklists e Rotinas')} title="Acessar rotinas"><ClipboardCheck size={17}/><span>Rotinas</span></button><button className="mop-home57-refresh" type="button" onClick={refreshHome} disabled={loading} title={lastUpdated?"Atualizar registros · última leitura "+clockFormat.format(lastUpdated):"Atualizar registros"} aria-label={loading?"Atualizando registros":"Atualizar registros"}><RefreshCw size={18} className={loading?"mop-home56-spin":undefined}/></button></div>
   </div>
  </section>
  <div className="mop-home63-feedback" aria-live="polite"><span className={error?'mop-home63-sync failed':stale?'mop-home63-sync stale':'mop-home63-sync'}><span className="mop-home63-dot"/>{error?'Falha na atualização':loading?'Sincronizando registros…':stale?'Dados desatualizados':lastUpdated?'Atualizado às '+clockFormat.format(lastUpdated):'Aguardando sincronização'}</span><span className="mop-home63-shortcuts" title="Atalhos disponíveis na tela Início">Atalhos: Alt+N Novo registro · Alt+P Passagem · Alt+R Atualizar</span></div>
  {newPendingNotice>0&&<div className="mop-home63-notice" role="status"><Flag size={17}/><span>{newPendingNotice===1?'Uma nova pendência identificada':'Novas pendências identificadas: '+newPendingNotice}</span><button type="button" onClick={()=>{setNewPendingNotice(0);setEventFilter('Pendentes')}}>Ver pendências</button><button type="button" aria-label="Dispensar aviso" title="Dispensar" onClick={()=>setNewPendingNotice(0)}>×</button></div>}
  {error&&<div className="mop-home54-warning" role="status">{error} <button type="button" onClick={refreshHome}>Tentar novamente</button></div>}
  <div className="mop-home109-window-note" role="status"><Clock3 size={15}/><span><strong>Últimas 12 horas:</strong> {recentWindow.length} registro(s), {recentOpen} ainda aberto(s). Intervalo de referência operacional, não substitui a escala cadastrada.</span></div>
  <section className="mop-home109-briefing" aria-label="Prioridades e próximas atividades do plantão">
   <div className="mop-home109-briefing-heading"><div><ShieldCheck size={19}/><strong>Orientação do plantão</strong></div><span>Informações do escopo autorizado</span></div>
   <div className="mop-home109-briefing-grid">
    <div className="mop-home109-focus"><div className="mop-home109-focus-title"><AlertTriangle size={17}/><strong>O que exige atenção</strong><button type="button" onClick={()=>onNavigate('Ocorrências')}>Ver ocorrências <ArrowRight size={13}/></button></div>
     {urgent.length?urgent.map(r=><button type="button" className="mop-home109-briefing-item" key={r.id} onClick={()=>onOpenRecord(r.id)}><span className="mop-home109-alert-dot"/><span><strong>{r.title}</strong><small>{r.condo} · {r.status}</small></span><ArrowRight size={14}/></button>):<p className="mop-home109-empty">Nenhuma ocorrência de Segurança pendente ou de prioridade crítica foi identificada nesta consulta.</p>}
     {overdue.length>0&&<p className="mop-home109-aged"><Clock3 size={14}/>{overdue.length} pendência(s) aberta(s) há pelo menos 24 horas. <button type="button" onClick={()=>onNavigate('Ocorrências')}>Acompanhar</button></p>}
    </div>
    <div className="mop-home109-tasks"><div className="mop-home109-focus-title"><ClipboardCheck size={17}/><strong>Próximas rotinas</strong><button type="button" onClick={()=>onNavigate('Checklists e Rotinas')}>Abrir rotinas <ArrowRight size={13}/></button></div>
     {demo?<p className="mop-home109-empty">Rotinas não são carregadas neste ambiente de demonstração.</p>:role==='viewer'?<p className="mop-home109-empty" role="status">Indicadores de rotinas indisponíveis para este perfil.</p>:routineError?<p className="mop-home109-empty">Não foi possível consultar as rotinas neste momento. Abra Checklists e Rotinas para conferir.</p>:routineData===null?<p className="mop-home109-empty">Consultando rotinas deste período...</p>:nextTasks.length?nextTasks.map(t=><button type="button" className="mop-home109-briefing-item" key={t.id} onClick={()=>onNavigate('Checklists e Rotinas')}><span className="mop-home109-task-dot"/><span><strong>{t.title}</strong><small>{t.reminder_time?'Prevista '+t.reminder_time.slice(0,5):'Sem horário definido'} · {t.period}</small></span><ArrowRight size={14}/></button>):<p className="mop-home109-empty">Nenhuma rotina pendente prevista para o período atual.</p>}
     {role!=='viewer'&&routineData&&<p className="mop-home109-task-footer">{routineData.tasks.filter(t=>t.done).length} de {routineData.tasks.length} rotinas concluídas · base {routineData.scope==='local'?'local':'central'}</p>}
    </div>
   </div>
  </section>
  <div className="records-metrics mop-home58-metrics" aria-label="Resumo das ocorrências">
   {([{label:'Total de registros',value:records.length,tone:'blue',icon:FileText},{label:'Concluídos',value:completed.length,tone:'green',icon:CheckCircle2},{label:'Em andamento',value:ongoing.length,tone:'amber',icon:RotateCw},{label:'Pendentes',value:pending.length,tone:'red',icon:AlertTriangle}] as const).map(({label,value,tone,icon:Icon})=><div className={'records-metric '+tone} key={label}><div className="records-metric-icon"><Icon size={23}/></div><div className="records-metric-info"><strong>{String(value).padStart(2,'0')}</strong><span>{label}</span></div><svg viewBox="0 0 68 31" className="records-spark" aria-hidden="true"><path d="M0 23 C11 17 18 27 28 16 S42 8 48 13 S57 14 68 3" stroke="currentColor" strokeWidth="2.3" fill="none" strokeLinecap="round"/></svg></div>)}
  </div>
  <OverviewCharts1097 records={records} routines={routineData} loading={loading} error={error} routineLoading={routineBusy} routineError={routineError} canViewRoutines={role!=='viewer'} demo={demo} accepted={accepted||role==='viewer'} now={now} onOpenRoutines={()=>onNavigate('Checklists e Rotinas')}/>
  {!demo&&accepted&&<section className="mop-home62-continuity" aria-label="Continuidade operacional"><div className="mop-home62-continuity-head"><div><ArrowLeftRight size={19}/><strong>Continuidade operacional</strong></div><button type="button" onClick={()=>onNavigate('Passagem de Turno')}>Abrir passagem <ArrowRight size={15}/></button></div>{continuityBusy?<p>Consultando a passagem de turno…</p>:continuityError?<p role="status">Informações de continuidade indisponíveis nesta consulta. Consulte a Passagem de Turno.</p>:continuity?.stage==='receipt'&&continuity.deliveryId?<><p className="mop-home62-summary">Entrega anterior aguardando recebimento{continuity.outgoing?' · '+continuity.outgoing:''}. Confira os registros transmitidos.</p><div className="mop-home62-list">{continuity.items.filter(r=>r.status!=='Concluído').slice(0,3).map(r=><div className="mop-home62-item" key={r.id}><span className={r.critical?'mop-home62-critical':'mop-home62-normal'} /><div><strong>{r.title}</strong><small>Responsável: {r.assignee?.trim()||'Não definido'} · Próxima ação: {r.nextAction?.trim()||'Não informada'}</small><small>Última referência: {r.occurredAt?ageLabel(r.occurredAt,now):'não disponível'}</small></div><button type="button" onClick={()=>onOpenRecord(r.id)} title="Ver ocorrência"><ArrowRight size={16}/></button></div>)}{!continuity.items.some(r=>r.status!=='Concluído')&&<p>Nenhum registro aberto foi informado nesta entrega.</p>}</div></>:<p>Não há entrega anterior aguardando recebimento neste momento. Consulte a Passagem de Turno para informações do período.</p>}</section>}
  <div className="mop-home54-grid mop-home59-grid">
   <section className="mop-home54-panel mop-home59-panel" aria-labelledby="mop-home59-events-title">
    <header><div><History size={20}/><h3 id="mop-home59-events-title">Principais acontecimentos</h3></div><button type="button" onClick={()=>onNavigate('Registros')}>Ver registros <ArrowRight size={15}/></button></header>
    <div className="mop-home60-filterbar"><p className="mop-home54-panel-caption">Atividade recente dos registros disponíveis</p><div role="group" aria-label="Filtrar acontecimentos">{(['Todos','Pendentes','Em andamento'] as const).map(f=><button type="button" key={f} className={eventFilter===f?'active':''} aria-pressed={eventFilter===f} onClick={()=>setEventFilter(f)}>{f}</button>)}</div></div>
    <div className="mop-home59-timeline">{loading?<p className="mop-home59-empty">Atualizando acontecimentos...</p>:latest.length?latest.map(r=><button type="button" key={r.id} className="mop-home59-timeline-item" onClick={()=>onOpenRecord(r.id)}><span className={'mop-home59-timeline-marker '+(r.status==='Concluído'?'done':'open')}>{r.status==='Concluído'?<CheckCircle2 size={15}/>:<FileText size={15}/>}</span><span className="mop-home59-item-main"><strong>{r.title}</strong><small>{r.condo} · {r.status}</small></span><time className="mop-home59-time" dateTime={r.occurredAt}>{safeTime(r.occurredAt)}<small>{dateFormat.format(new Date(r.occurredAt))}</small></time></button>):<div className="mop-home59-empty"><History size={23}/><strong>Nenhum acontecimento recente</strong><span>Novos registros aparecerão aqui quando estiverem disponíveis.</span><button type="button" className="mop-home65-empty-action" onClick={()=>onNavigate('Registros')}>Consultar registros <ArrowRight size={14}/></button></div>}</div>
   </section>
   <section className="mop-home54-panel mop-home59-panel" aria-labelledby="mop-home59-pending-title">
    <header><div><Flag size={20}/><h3 id="mop-home59-pending-title">Pendências em acompanhamento</h3></div><button type="button" onClick={()=>onNavigate('Passagem de Turno')}>Ver passagem <ArrowRight size={15}/></button></header>
    <p className="mop-home54-panel-caption">Registros ainda pendentes ou em andamento</p>
    <div className="mop-home59-pending-list">{loading?<p className="mop-home59-empty">Atualizando pendências...</p>:active.length?active.slice(0,4).map(r=><button type="button" key={r.id} className="mop-home59-pending-item" onClick={()=>onOpenRecord(r.id)}><span className={'mop-home59-status '+(r.status==='Pendente'?'pending':'ongoing')}/><span className="mop-home59-item-main"><strong>{r.title}</strong><small>{r.condo} · {ageLabel(r.occurredAt,now)}</small></span><span className={'mop-home59-status-label '+(r.status==='Pendente'?'pending':'ongoing')}>{r.status}</span><ArrowRight size={15}/></button>):<div className="mop-home59-empty"><CheckCircle2 size={24}/><strong>Nenhuma pendência aberta</strong><span>Não há registros pendentes ou em andamento nesta consulta.</span><button type="button" className="mop-home65-empty-action" onClick={()=>onNavigate('Passagem de Turno')}>Consultar passagem <ArrowRight size={14}/></button></div>}</div>
   </section>
  </div>
  <p className="mop-home54-disclaimer">{demo?'Ambiente de demonstração.':'Visão baseada nos registros disponíveis ao usuário.'} Os totais não comprovam execução de checklists. {loading?'Atualizando…':''}</p>
 </div>
}
