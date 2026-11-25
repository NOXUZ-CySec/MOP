import React,{useEffect,useMemo,useState} from 'react';
import {AlertTriangle,ShieldAlert,Clock3,CheckCircle2,Search,CalendarDays,SlidersHorizontal,Building2,Tag,RefreshCw,ArrowRight,ClipboardList,FileText,UserRound,Activity,History,ChevronRight,Info,Pencil,ArrowLeftRight} from 'lucide-react';
import type {OperationalRecord} from './RecordsPage';
import RecordFilterDropdown from './RecordFilterDropdown';
import './occurrences102.css';
import './occurrences108.css';

type Tracking={record_protocol:string;priority:string;assigned_user_id:string|null;updated_at?:string};
type Update={id:string;record_protocol:string;note:string;author_id:string;created_at:string};
type Member={user_id:string;display_name?:string;username?:string;condos?:string[]|null;role?:string};
type StatusChange={id:string;record_protocol:string;from:string;to:string;at:string;actor:string;kind:string;source:string};
type Snapshot={tracking:Tracking[];updates:Update[];members:Member[];statusHistory?:StatusChange[]};
type Props={records:OperationalRecord[],role:string,demo:boolean,loading:boolean,error:string,onRefresh:()=>void,onOpenRecord:(id:string)=>void,onEditRecord:(id:string)=>void,onNewRecord:()=>void};
const formatDate=(value:string)=>{const t=new Date(value);return Number.isFinite(t.getTime())?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(t):'Data indisponível'};
const dateKey=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const priority=(value:string|undefined)=>{const v=(value||'').toLowerCase();return /cr[ií]tic|urgente|emerg[eê]ncia/.test(v)?'Crítica':/alta|high/.test(v)?'Alta':/m[eé]dia|moderad/.test(v)?'Média':/baixa|low/.test(v)?'Baixa':/normal/.test(v)?'Normal':'Não definida'};
export default function Occurrences102({records,role,demo,loading,error,onRefresh,onOpenRecord,onEditRecord,onNewRecord}:Props){
 const [snapshot,setSnapshot]=useState<Snapshot>({tracking:[],updates:[],members:[],statusHistory:[]}),[trackingError,setTrackingError]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState(''),[editPriority,setEditPriority]=useState('Normal'),[editAssignee,setEditAssignee]=useState('Nenhum');
 const manager=role==='admin'||role==='supervisor';
 const [clockNow,setClockNow]=useState(Date.now());useEffect(()=>{const timer=setInterval(()=>setClockNow(Date.now()),60000);return()=>clearInterval(timer)},[]);
 const loadTracking=async()=>{if(demo)return;try{const data=await window.mopDesktop?.occurrence103?.('list') as Snapshot|undefined;if(data){setSnapshot(data);setTrackingError('')}}catch(e){setTrackingError(e instanceof Error?e.message:'Não foi possível consultar acompanhamento.')}};
 useEffect(()=>{void loadTracking()},[demo]);
 useEffect(()=>{if(demo)return;const off=window.mopDesktop?.onSync?.(x=>{if(x?.dataChanged)void loadTracking()});const timer=setInterval(()=>void loadTracking(),30000);return()=>{off?.();clearInterval(timer)}},[demo]);
 const [query,setQuery]=useState(''),[status,setStatus]=useState('Todos os status'),[category,setCategory]=useState('Todas as categorias'),[condo,setCondo]=useState('Todos os condomínios'),[period,setPeriod]=useState('Todos os períodos'),[chosen,setChosen]=useState<string|null>(null);
 const [assignee,setAssignee]=useState('Todos os responsáveis'),[focus,setFocus]=useState('Todas as ocorrências'),[ageHours,setAgeHours]=useState(24);
 const occurrences=useMemo(()=>records.filter(r=>r.category!=='Rotina'||r.status!=='Concluído').sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt)),[records]);
 const trackingMap=useMemo(()=>new Map(snapshot.tracking.map(t=>[t.record_protocol,t])),[snapshot.tracking]);
 const severity=(r:OperationalRecord)=>priority(trackingMap.get(r.id)?.priority||r.priority);
 const aging=(r:OperationalRecord)=>r.status!=='Concluído'&&Number.isFinite(Date.parse(r.occurredAt))&&clockNow-Date.parse(r.occurredAt)>=ageHours*3600000;
 const criticalList=occurrences.filter(r=>r.status!=='Concluído'&&severity(r)==='Crítica');
 const agedList=occurrences.filter(aging);
 const assignedIds=[...new Set(snapshot.tracking.map(t=>t.assigned_user_id).filter((x):x is string=>!!x))];
 const assignedOptions=['Todos os responsáveis','Sem responsável',...assignedIds];
 const assignedName=(id:string)=>id==='Todos os responsáveis'?'Responsável':id==='Sem responsável'?'Sem responsável':snapshot.members.find(x=>x.user_id===id)?.display_name||snapshot.members.find(x=>x.user_id===id)?.username||'Usuário atribuído';
 const filtered=useMemo(()=>occurrences.filter(r=>{
  const text=[r.id,r.title,r.description,r.condo,r.details].join(' ').toLocaleLowerCase('pt-BR');
  if(query&&!text.includes(query.toLocaleLowerCase('pt-BR')))return false;
  if(status!=='Todos os status'&&r.status!==status)return false;
  const who=trackingMap.get(r.id)?.assigned_user_id||null;
  if(assignee==='Sem responsável'&&who)return false;
  if(assignee!=='Todos os responsáveis'&&assignee!=='Sem responsável'&&who!==assignee)return false;
  if(focus==='Críticas abertas'&&!(r.status!=='Concluído'&&severity(r)==='Crítica'))return false;
  if(focus==='Pendências antigas'&&!aging(r))return false;
  if(focus==='Sem responsável'&&(r.status==='Concluído'||who))return false;
  if(category!=='Todas as categorias'&&r.category!==category)return false;
  if(condo!=='Todos os condomínios'&&r.condo!==condo)return false;
  const d=new Date(r.occurredAt),time=d.getTime();if(!Number.isFinite(time))return period==='Todos os períodos';
  if(period==='Hoje')return dateKey(d)===dateKey(new Date());
  if(period==='Últimos 7 dias')return time>=Date.now()-7*86400000;
  if(period==='Últimos 30 dias')return time>=Date.now()-30*86400000;
  return true;
 }),[occurrences,query,status,category,condo,period,assignee,focus,ageHours,trackingMap,clockNow]);
 const selected=filtered.find(x=>x.id===chosen)||filtered[0]||null;
 const track=selected?snapshot.tracking.find(x=>x.record_protocol===selected.id):undefined;
 const assigned=snapshot.members.find(m=>m.user_id===track?.assigned_user_id);
 const permittedMembers=selected?snapshot.members.filter(m=>m.condos==null||m.condos.includes(selected.condo)):[];
 const updates=selected?snapshot.updates.filter(x=>x.record_protocol===selected.id):[];
 const statusChanges=selected?(snapshot.statusHistory||[]).filter(x=>x.record_protocol===selected.id):[];
 const historyEntries=[...updates.map(u=>({id:u.id,at:u.created_at,label:u.note,author:snapshot.members.find(m=>m.user_id===u.author_id)?.display_name||'Equipe',kind:'Providência',origin:'Central'})),...statusChanges.map(x=>({id:x.id,at:x.at,label:x.kind+': '+x.from+' → '+x.to,author:x.actor,kind:x.kind,origin:x.source}))].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
 const minutesOpen=selected?Math.max(0,Math.floor(((selected.status==='Concluído'?Date.parse(selected.updatedAt||selected.occurredAt):clockNow)-Date.parse(selected.occurredAt))/60000)):0;
 const duration=minutesOpen<60?minutesOpen+' min':Math.floor(minutesOpen/1440)>0?Math.floor(minutesOpen/1440)+' d '+Math.floor(minutesOpen%1440/60)+' h':Math.floor(minutesOpen/60)+' h '+minutesOpen%60+' min';
 const edit=async(operation:'assign'|'note'|'status',data:Record<string,unknown>)=>{
  if(!selected||busy)return;setBusy(true);setTrackingError('');
  try{await window.mopDesktop?.occurrence103?.(operation,{id:selected.id,...data});if(operation==='note')setNote('');await loadTracking();if(operation==='status')onRefresh()}
  catch(e){setTrackingError(e instanceof Error?e.message:'Não foi possível salvar a ocorrência.')}finally{setBusy(false)}
 };
 useEffect(()=>{setEditPriority(track?.priority||'Normal');setEditAssignee(track?.assigned_user_id||'Nenhum');setNote('')},[selected?.id,track?.priority,track?.assigned_user_id]);
 useEffect(()=>{if(chosen&&!occurrences.some(r=>r.id===chosen))setChosen(null)},[chosen,occurrences]);
 const clear=()=>{setQuery('');setStatus('Todos os status');setCategory('Todas as categorias');setCondo('Todos os condomínios');setPeriod('Todos os períodos');setAssignee('Todos os responsáveis');setFocus('Todas as ocorrências');setAgeHours(24)};
 const unresolved=occurrences.filter(r=>r.status!=='Concluído');
 const today=dateKey(new Date());
 const metrics=[
  {label:'Em aberto',value:unresolved.length,icon:AlertTriangle,tone:'amber'},
  {label:'Em andamento',value:occurrences.filter(r=>r.status==='Em andamento').length,icon:Clock3,tone:'blue'},
  {label:'Resolvidas hoje',value:occurrences.filter(r=>r.status==='Concluído'&&dateKey(new Date(r.updatedAt||r.occurredAt))===today).length,icon:CheckCircle2,tone:'green'},
  {label:'Críticas',value:criticalList.length,icon:ShieldAlert,tone:'red'},
  {label:'Pendências antigas',value:agedList.length,icon:Clock3,tone:'amber'}
 ];
 return <div className="occ102">
  <header className="occ102-heading"><div className="occ102-title"><AlertTriangle size={30}/><div><h1>Ocorrências</h1><p>Monitoramento, providências e continuidade entre plantões.</p></div></div><div className="occ102-top-actions"><button type="button" className="occ102-refresh" onClick={onRefresh} disabled={loading}><RefreshCw size={16}/> Atualizar</button>{role!=='viewer'&&<button type="button" className="occ102-primary" onClick={onNewRecord}><FileText size={16}/> Novo registro</button>}</div></header>
  {demo&&<p className="occ102-message"><Info size={15}/> Ambiente demonstrativo — dados fictícios.</p>}
  {error&&<p className="occ102-message error" role="alert"><AlertTriangle size={15}/>{error}</p>}
  {trackingError&&<p className="occ102-message error" role="alert"><AlertTriangle size={15}/>{trackingError}</p>}
  {(criticalList.length>0||agedList.length>0)&&<div className="occ108-alert" role="status"><ShieldAlert size={20}/><div><strong>Atenção operacional</strong><span>{criticalList.length} ocorrência(s) crítica(s) aberta(s) · {agedList.length} pendência(s) com pelo menos {ageHours} hora(s) desde o registro.</span></div><button type="button" onClick={()=>setFocus('Críticas abertas')} disabled={!criticalList.length}>Ver críticas</button><button type="button" onClick={()=>setFocus('Pendências antigas')} disabled={!agedList.length}>Ver antigas</button></div>}
  <div className="occ102-metrics">{metrics.map(({label,value,icon:Icon,tone})=><div key={label} className={'occ102-metric '+tone}><span className="occ102-metric-icon"><Icon size={22}/></span><div><strong>{String(value).padStart(2,'0')}</strong><span>{label}</span></div></div>)}</div>
  <div className="occ102-filters"><label className="occ102-search"><Search size={18}/><input aria-label="Buscar ocorrências" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por título, registro ou condomínio"/></label>
   <RecordFilterDropdown label="Status" icon={SlidersHorizontal} value={status} options={['Todos os status','Pendente','Em andamento','Concluído']} display={v=>v==='Todos os status'?'Status':v} onChange={setStatus}/>
   <RecordFilterDropdown label="Categoria" icon={Tag} value={category} options={['Todas as categorias',...new Set(occurrences.map(r=>r.category))]} display={v=>v==='Todas as categorias'?'Categoria':v} onChange={setCategory}/>
   <RecordFilterDropdown label="Condomínio" icon={Building2} value={condo} options={['Todos os condomínios',...new Set(occurrences.map(r=>r.condo))]} display={v=>v==='Todos os condomínios'?'Condomínio':v} onChange={setCondo}/>
   <RecordFilterDropdown label="Período" icon={CalendarDays} value={period} options={['Todos os períodos','Hoje','Últimos 7 dias','Últimos 30 dias']} display={v=>v==='Todos os períodos'?'Período':v} onChange={setPeriod}/>
   <RecordFilterDropdown label="Responsável" icon={UserRound} value={assignee} options={assignedOptions} display={assignedName} onChange={setAssignee}/>
   <RecordFilterDropdown label="Atenção" icon={ShieldAlert} value={focus} options={['Todas as ocorrências','Críticas abertas','Pendências antigas','Sem responsável']} display={v=>v==='Todas as ocorrências'?'Atenção':v} onChange={setFocus}/>
   <RecordFilterDropdown label="Idade mínima" icon={Clock3} value={String(ageHours)} options={['24','48','72','168']} display={v=>v+'h em aberto'} onChange={v=>setAgeHours(Number(v))}/>
   <button type="button" className="occ102-clear" onClick={clear}>Limpar filtros</button>
  </div>
  <div className="occ102-layout"><section className="occ102-list"><div className="occ102-section-title"><h2>Fila operacional</h2><span>{filtered.length} ocorrência(s)</span></div>
    {loading&&<p className="occ102-empty">Atualizando informações da central...</p>}
    {!loading&&filtered.length===0&&<div className="occ102-empty"><ClipboardList size={28}/><strong>{occurrences.length?'Nenhuma ocorrência corresponde aos filtros':'Nenhuma ocorrência disponível'}</strong><span>Os registros que exigem acompanhamento aparecerão aqui, respeitando seus acessos.</span></div>}
    <div className="occ102-items">{filtered.map(r=>{const Icon=r.icon,selectedRow=selected?.id===r.id;return <button type="button" key={r.id} className={'occ102-item'+(selectedRow?' selected':'')} aria-pressed={selectedRow} onClick={()=>setChosen(r.id)}>
      <span className="occ102-item-icon"><Icon size={18}/></span><span className="occ102-item-main"><strong>{r.title}</strong><small>{r.condo} · {formatDate(r.occurredAt)}</small><span className="occ102-item-description">{r.description}</span><span className="occ108-flags">{r.status!=='Concluído'&&severity(r)==='Crítica'&&<em className="critical">Crítica aberta</em>}{aging(r)&&<em className="old">{Math.floor(Math.max(0,clockNow-Date.parse(r.occurredAt))/3600000)}h desde o registro</em>}{r.status!=='Concluído'&&!trackingMap.get(r.id)?.assigned_user_id&&<em>Sem responsável</em>}</span></span><span className={'occ102-status '+(r.status==='Concluído'?'done':r.status==='Em andamento'?'progress':'pending')}>{r.status}</span><ChevronRight size={17} className="occ102-arrow"/>
    </button>})}</div>
   </section>
   <aside className="occ102-detail">{selected?<><div className="occ102-section-title"><h2>Detalhes da ocorrência</h2><span className={'occ102-status '+(selected.status==='Concluído'?'done':selected.status==='Em andamento'?'progress':'pending')}>{selected.status}</span></div>
   <div className="occ102-detail-title"><selected.icon size={24}/><div><strong>{selected.title}</strong><small>{selected.id}</small></div></div>
   <dl className="occ102-facts"><div><dt><Building2 size={14}/> Condomínio</dt><dd>{selected.condo}</dd></div><div><dt><Tag size={14}/> Categoria</dt><dd>{selected.category}</dd></div><div><dt><ShieldAlert size={14}/> Prioridade</dt><dd>{priority(track?.priority||selected.priority)}</dd></div><div><dt><CalendarDays size={14}/> Registrada em</dt><dd>{formatDate(selected.occurredAt)}</dd></div><div><dt><Clock3 size={14}/> {selected.status==='Concluído'?'Duração até conclusão':'Tempo em aberto'}</dt><dd>{duration}</dd></div><div><dt><UserRound size={14}/> Responsável pelo registro</dt><dd>{selected.author}</dd></div><div><dt><UserRound size={14}/> Responsável pelo acompanhamento</dt><dd>{assigned?.display_name||assigned?.username||'Não atribuído'}</dd></div></dl>
   <section className="occ102-notes"><h3><ClipboardList size={16}/> Descrição e providências</h3><p>{selected.description||'Sem descrição.'}</p>{selected.actionTaken&&<div><strong>Providências tomadas</strong><p>{selected.actionTaken}</p></div>}{selected.nextAction&&<div><strong>Próxima ação</strong><p>{selected.nextAction}</p></div>}</section>
   <section className="occ103-management"><h3><SlidersHorizontal size={16}/> Gestão da ocorrência</h3>
   {manager&&!demo&&<div className="occ103-assign"><label>Prioridade<RecordFilterDropdown label="Prioridade" value={editPriority} options={['Baixa','Normal','Alta','Crítica']} onChange={setEditPriority}/></label><label>Responsável<RecordFilterDropdown label="Responsável" value={editAssignee} options={['Nenhum',...permittedMembers.map(m=>m.user_id)]} display={id=>id==='Nenhum'?'Não atribuído':permittedMembers.find(m=>m.user_id===id)?.display_name||permittedMembers.find(m=>m.user_id===id)?.username||id} onChange={setEditAssignee}/></label><button disabled={busy} type="button" onClick={()=>void edit('assign',{priority:editPriority,assigned_user_id:editAssignee==='Nenhum'?null:editAssignee})}>Salvar gestão</button></div>}
   <label className="occ103-status-field">Status da ocorrência<RecordFilterDropdown label="Status" value={selected.status} options={selected.status==='Concluído'&&!manager?['Concluído']:['Pendente','Em andamento','Concluído']} onChange={v=>{if(!demo&&v!==selected.status)void edit('status',{status:v==='Concluído'?'Resolvido':v})}}/></label>
   {!demo&&role!=='viewer'&&<div className="occ103-note-editor"><label>Registrar providência<textarea rows={3} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Descreva a ação realizada e as próximas etapas"/></label><button type="button" disabled={busy||note.trim().length<4} onClick={()=>void edit('note',{note})}>Adicionar ao histórico</button></div>}
   {demo&&<p>Modo de demonstração: as ações operacionais estão desativadas.</p>}
   </section>
   <section className="occ102-history"><h3><History size={16}/> Linha do tempo</h3><div className="occ102-timeline">{historyEntries.map(e=><div key={e.id}><span className="occ102-timeline-dot"/><strong>{e.label}</strong><small>{e.author} · {formatDate(e.at)} · {e.origin}</small></div>)}<div><span className="occ102-timeline-dot"/><strong>Registro criado</strong><small>{formatDate(selected.occurredAt)}</small></div>{selected.updatedAt&&selected.updatedAt!==selected.occurredAt&&<div><span className="occ102-timeline-dot"/><strong>Última atualização</strong><small>{formatDate(selected.updatedAt)}</small></div>}</div><p>As mudanças de status exibidas são as verificadas na auditoria desta estação; registros realizados em outra máquina podem não constar aqui. As providências vêm do acompanhamento central. O histórico completo permanece no registro original.</p></section>
   <div className="occ102-detail-actions"><button type="button" className="occ102-primary" onClick={()=>onOpenRecord(selected.id)}><ArrowRight size={16}/> Abrir registro</button>{role!=='viewer'&&<button type="button" onClick={()=>onEditRecord(selected.id)}><Pencil size={15}/> Editar registro original</button>}</div>
   </>:<div className="occ102-empty"><Activity size={26}/><strong>Selecione uma ocorrência</strong><span>Detalhes e providências aparecerão neste painel.</span></div>}</aside></div>
  <p className="occ102-footer"><Info size={13}/> Os alertas de idade consideram horas desde a criação, não prazos contratuais de SLA. Os dados seguem o escopo autorizado; não são criadas ocorrências duplicadas.</p>
 </div>;
}
