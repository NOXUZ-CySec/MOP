import { PageHeader } from "./PageHeader";
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,ArrowLeftRight,Info,AlertTriangle,X,Undo2,Save,BriefcaseBusiness,CalendarOff,Flag,Clock3,CalendarCheck2,Palmtree,ArrowLeftRight as SwapIcon} from 'lucide-react';
import {generateSchedule,type DayKind,type Pattern,type ShiftOverride,type SwapRequest,type ScheduleData} from './SchedulePage';
import './schedule70.css';
import {rangeSelection} from './schedule-drag109.cjs';
import RecordFilterDropdown from './RecordFilterDropdown';
import CycleDatePicker from './CycleDatePicker';
import SwapCalendar109 from './SwapCalendar109';
const pad=(n:number)=>String(n).padStart(2,'0');
const key=(y:number,m:number,d:number)=>[y,pad(m+1),pad(d)].join('-');
const nice=(date:string)=>date.split('-').reverse().join('/');
const model12x36:Pattern={id:'12x36',label:'12×36',cycle:[1,0],anchor:'2026-11-01',start:'06:00',end:'18:00',timezone:'America/Sao_Paulo'};
const icons:Record<DayKind,typeof BriefcaseBusiness>={work:BriefcaseBusiness,off:CalendarOff,'holiday-work':Flag,'holiday-off':CalendarCheck2,extra:Clock3,swap:SwapIcon,absence:CalendarOff,medical:CalendarCheck2,vacation:Palmtree};
const kinds:{id:DayKind;name:string}[]=[{id:'work',name:'Plantão'},{id:'off',name:'Folga'},{id:'holiday-work',name:'Feriado trabalhado'},{id:'extra',name:'Folga trabalhada'},{id:'swap',name:'Troca'},{id:'absence',name:'Falta'},{id:'medical',name:'Atestado'},{id:'vacation',name:'Férias'}];
type Edit={date:string;kind:DayKind};
type Swap94=SwapRequest&{employee_id?:string;colleague_id?:string;colleague_work_date?:string;colleague_response?:'pending'|'accepted'|'declined';created_at?:string};
type Peer94={id:string;name:string;role:string};

export default function Schedule70({role='operator',demo=false,employeeId='',employeeName='Colaborador'}:{role?:string;demo?:boolean;employeeId?:string;employeeName?:string}){
 const manager=role==='admin'||role==='supervisor';const canEdit=manager&&!demo;
 const now=new Date();const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);const [year,setYear]=useState(now.getFullYear()),[month,setMonth]=useState(now.getMonth()),[target,setTarget]=useState(employeeId),[anchorDate,setAnchorDate]=useState(key(now.getFullYear(),now.getMonth(),1));
 const [scope,setScope]=useState('local');const [loadStatus,setLoadStatus]=useState<'loading'|'ready'|'error'>(demo?'ready':'loading');const loadSequence=useRef(0);const [rows,setRows]=useState<ShiftOverride[]>([]),[requests,setRequests]=useState<Swap94[]>([]),[pending,setPending]=useState<Swap94[]>([]),[incoming,setIncoming]=useState<Swap94[]>([]),[peers,setPeers]=useState<Peer94[]>([]);
 const [selection,setSelection]=useState<string[]>([]),[cursorAnchor,setCursorAnchor]=useState<string|null>(null),[draft,setDraft]=useState<Record<string,DayKind>>({}),[undo,setUndo]=useState<Record<string,DayKind>[]>([]);
 const [pickerPosition,setPickerPosition]=useState<{top:number;left:number}>({top:0,left:0});const calendarRef=useRef<HTMLDivElement|null>(null);const pickerRef=useRef<HTMLDivElement|null>(null);const lastDateRef=useRef<string|null>(null);const [picker,setPicker]=useState(false),[dragging,setDragging]=useState(false),[dragMoved,setDragMoved]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[saveError,setSaveError]=useState(''),[confirm,setConfirm]=useState(false),[swapOpen,setSwapOpen]=useState(false),[swapDate,setSwapDate]=useState(''),[colleague,setColleague]=useState(''),[peerId,setPeerId]=useState(''),[peerDate,setPeerDate]=useState(''),[reason,setReason]=useState('');
 const dragRef=useRef<{active:boolean;start:string;last:string;baseline:string[];moved:boolean}|null>(null);
 const api=window.mopDesktop?.schedule68;
 const load=async()=>{if(demo)return;const request=++loadSequence.current;setLoadStatus('loading');try{
  if(!api)throw Error('Integração de escala indisponível.');
  const data=await api('load',{employeeId:target||employeeId,month:key(year,month,1).slice(0,7)});
  if(request!==loadSequence.current)return;const currentScope=data.scope||'local';setScope(currentScope);
  setRows((data.rows||[]).map((x:any)=>({date:x.date,kind:x.kind,reason:x.reason,approved:true})));
  setRequests((data.requests||[]).map((x:any)=>({...x,date:x.date||x.work_date})));
  if(currentScope==='central'){
   const [team,received,waiting]=await Promise.all([api('peers'),api('inbox'),manager?api('pending'):Promise.resolve([])]);
   if(request!==loadSequence.current)return;setPeers(team||[]);setIncoming((received||[]).map((x:any)=>({...x,date:x.date||x.work_date})));
   setPending(waiting||[]);
  }else{
   setPeers([]);setIncoming([]);if(manager){const waiting=await api('pending');if(request!==loadSequence.current)return;setPending(waiting||[])}else setPending([]);
  }
 if(request===loadSequence.current)setLoadStatus('ready');
 }catch(e){if(request!==loadSequence.current)return;setLoadStatus('error');setMessage(e instanceof Error?e.message:'Erro ao consultar escala.')}};
 useEffect(()=>{void load();return()=>{loadSequence.current++}},[year,month,target,employeeId,demo]);
 useEffect(()=>{if(demo)return;return window.mopDesktop?.onSync?.(state=>{if(state?.dataChanged)void load()})},[demo,year,month,target,employeeId]);
 useEffect(()=>{const finish=()=>{if(dragRef.current?.active){dragRef.current.active=false;setDragging(false);if(dragRef.current.moved)openPicker()}};const cancel=(e:KeyboardEvent)=>{if(e.key==='Escape'){setPicker(false);setSelection([])}if(canEdit&&e.ctrlKey&&e.key.toLowerCase()==='z'&&undo.length){e.preventDefault();setDraft(undo[undo.length-1]);setUndo(x=>x.slice(0,-1))}};window.addEventListener('pointerup',finish);window.addEventListener('keydown',cancel);return()=>{window.removeEventListener('pointerup',finish);window.removeEventListener('keydown',cancel)}},[canEdit,undo]);
 const memberName=(id?:string,fallback='Colaborador')=>id===employeeId?employeeName:(peers.find(p=>p.id===id)?.name||fallback);
 const pattern=model12x36;
 const teamOptions=useMemo(()=>[...(employeeId?[{id:employeeId,name:employeeName,role}]:[]),...peers.filter(p=>p.id!==employeeId)].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),[peers,employeeId,employeeName,role]);
 const selectedName=memberName(target||employeeId);
 const data:ScheduleData=useMemo(()=>({employeeId:target||employeeId,employeeName:selectedName,pattern,holidays:{},overrides:rows,requests}),[target,employeeId,selectedName,pattern,rows,requests]);
 const days=useMemo(()=>generateSchedule(data,year,month).map(d=>({...d,kind:(draft[d.date]||d.kind)==='holiday-off'?'off':(draft[d.date]||d.kind)})),[data,year,month,draft]);
 const dayLabel=(d:{kind:DayKind;reason?:string})=>d.kind==='holiday-off'?'Folga':d.kind==='swap'?'Plantão (troca)':d.kind==='off'&&String(d.reason||'').startsWith('Troca aprovada')?'Folga (troca)':kinds.find(k=>k.id===d.kind)?.name||'Não informado';
 const offset=new Date(Date.UTC(year,month,1)).getUTCDay();const dates=days.map(d=>d.date);const selectedDay=selection.at(-1)||(today.startsWith(key(year,month,1).slice(0,7))?today:key(year,month,1));const active=days.find(d=>d.date===selectedDay);const ready=loadStatus==='ready';const workKinds=['work','holiday-work','extra','swap'];const totals=[{label:'Plantões',value:days.filter(d=>workKinds.includes(d.kind)).length,Icon:BriefcaseBusiness,tone:'work'},{label:'Folgas',value:days.filter(d=>d.kind==='off'||d.kind==='holiday-off').length,Icon:CalendarOff,tone:'off'},{label:'Férias',value:days.filter(d=>d.kind==='vacation').length,Icon:Palmtree,tone:'vacation'},{label:'Faltas e atestados',value:days.filter(d=>d.kind==='absence'||d.kind==='medical').length,Icon:CalendarCheck2,tone:'absence'}];
 const positionPicker=(date?:string|null)=>{const container=calendarRef.current;const day=date&&container?.querySelector<HTMLElement>('[data-scale-date="'+date+'"]');if(!container||!day)return;const bounds=container.getBoundingClientRect(),rect=day.getBoundingClientRect();const width=Math.min(252,Math.max(180,bounds.width-16));setPickerPosition({top:rect.bottom-bounds.top+8,left:Math.max(8,Math.min(rect.left-bounds.left,bounds.width-width-8))})};
 const openPicker=()=>{positionPicker(lastDateRef.current);setPicker(true)};
 useEffect(()=>{if(!picker)return;const dismiss=(e:PointerEvent)=>{if(!pickerRef.current?.contains(e.target as Node)&&!calendarRef.current?.contains(e.target as Node))setPicker(false)};document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss)},[picker]);
 const select=(date:string,e:React.PointerEvent<HTMLButtonElement>)=>{if(!canEdit||!ready||busy){setSelection([date]);return}if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);dragRef.current={active:true,start:date,last:date,baseline:(e.ctrlKey||e.metaKey)?selection.filter(x=>x!==date):[],moved:false};setDragging(true);setDragMoved(false);setPicker(false);lastDateRef.current=date;if(e.ctrlKey||e.metaKey){setSelection(prev=>prev.includes(date)?prev.filter(x=>x!==date):[...prev,date]);setCursorAnchor(date)}else if(e.shiftKey&&cursorAnchor){const a=dates.indexOf(cursorAnchor),b=dates.indexOf(date);const range=dates.slice(Math.min(a,b),Math.max(a,b)+1);setSelection(prev=>e.ctrlKey?[...new Set([...prev,...range])]:range)}else{setSelection([date]);setCursorAnchor(date)}};
 const hover=(date:string)=>{const drag=dragRef.current;if(!drag?.active||!canEdit||drag.last===date)return;drag.last=date;drag.moved=true;lastDateRef.current=date;setDragMoved(true);setSelection(rangeSelection(dates,drag.start,date,drag.baseline))};
 const release=(e:React.PointerEvent<HTMLButtonElement>)=>{if(!canEdit||!dragRef.current?.active)return;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);dragRef.current.active=false;setDragging(false);openPicker()};
 const apply=(kind:DayKind)=>{if(!selection.length||!ready||busy)return;setUndo(prev=>[...prev.slice(-19),{...draft}]);setDraft(prev=>{const next={...prev};selection.forEach(date=>next[date]=kind);return next});setPicker(false);setSelection([]);setMessage(selection.length+' dia(s) preparados. Clique em Salvar escala para gravar.')};
 const cycle=()=>{if(!ready||busy)return;const base=Date.parse(anchorDate+'T00:00:00Z');if(!Number.isFinite(base)){setMessage('Informe o primeiro plantão do ciclo.');return}setUndo(prev=>[...prev.slice(-19),{...draft}]);setDraft(prev=>{const next={...prev};days.forEach(day=>{const i=Math.round((Date.parse(day.date+'T00:00:00Z')-base)/86400000);next[day.date]=pattern.cycle[((i%pattern.cycle.length)+pattern.cycle.length)%pattern.cycle.length]?'work':'off'});return next});setMessage('Ciclo gerado para o mês. Confira os dias antes de salvar.')};
 const save=async()=>{if(!canEdit||!ready||!api||!Object.keys(draft).length||busy)return;setBusy(true);setSaveError('');try{const entries=Object.entries(draft).map(([date,kind])=>({date,kind}));const employee=target||employeeId;const result=await api('batch',{employeeId:employee,entries,reason:'Edição visual do calendário'});if(result?.saved!==entries.length)throw Error('O banco não confirmou a quantidade de alterações solicitadas.');const checked=await api('load',{employeeId:employee,month:key(year,month,1).slice(0,7)});const persisted=new Map((checked.rows||[]).map((r:{date:string;kind:DayKind})=>[r.date,r.kind]));const missing=entries.filter(x=>persisted.get(x.date)!==x.kind);if(missing.length)throw Error('Não foi possível confirmar '+missing.length+' dia(s) no banco. As alterações continuam pendentes; verifique sua conexão e tente novamente.');setRows((checked.rows||[]).map((x:any)=>({date:x.date,kind:x.kind,reason:x.reason,approved:true})));setDraft({});setUndo([]);setConfirm(false);setMessage(entries.length+' dia(s) salvos e conferidos na escala '+(checked.scope==='central'?'compartilhada.':'local.'))}catch(e){const error=e instanceof Error?e.message:'Erro ao salvar a escala.';setSaveError(error);setMessage('Falha ao salvar: '+error)}finally{setBusy(false)}};
 const exportSchedule=async(format:'pdf'|'xlsx')=>{if(Object.keys(draft).length){setMessage('Salve ou desfaça as alterações pendentes antes de exportar a escala.');return}try{if(!window.mopDesktop?.scheduleExport76)throw Error('Exportação indisponível.');const saved=await window.mopDesktop.scheduleExport76({month:key(year,month,1).slice(0,7),format,employeeId:target||employeeId,employeeName:selectedName,anchorDate});if(saved)setMessage('Escala exportada com sucesso.')}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível exportar a escala.')}};
 const decide=async(id:string,status:'approved'|'rejected')=>{
  if(!canEdit||!api||busy||!ready)return;
  setBusy(true);
  try{await api('decide',{id,status});await load();setMessage(status==='approved'?'Troca aprovada. As quatro classificações foram atualizadas.':'Troca recusada pelo gestor.')}
  catch(e){setMessage(e instanceof Error?e.message:'Erro ao analisar solicitação.')}
  finally{setBusy(false)}
 };
 const respondSwap=async(id:string,response:'accepted'|'declined')=>{
  if(!api||busy||demo||!ready)return;
  setBusy(true);
  try{await api('respond',{id,response});await load();setMessage(response==='accepted'?'Aceite registrado. A solicitação aguarda aprovação do supervisor.':'Solicitação recusada e encerrada.')}
  catch(e){setMessage(e instanceof Error?e.message:'Erro ao responder solicitação.')}
  finally{setBusy(false)}
 };
 const submitSwap=async(e:React.FormEvent)=>{
  e.preventDefault();if(!api||demo||busy||!ready)return;
  setBusy(true);
  try{
   if(scope==='central'&&(!peerId||!peerDate||peerDate===swapDate))throw Error('Selecione um colega e uma data diferente para o plantão dele.');
   const payload=scope==='central'?{date:swapDate,colleagueId:peerId,colleagueDate:peerDate,reason}:{date:swapDate,colleague,reason};
   await api('request',payload);setSwapOpen(false);setPeerId('');setPeerDate('');setColleague('');setReason('');await load();
   setMessage('Pedido enviado. O colega deverá aceitar antes da decisão do gestor.');
  }catch(e){setMessage(e instanceof Error?e.message:'Erro ao solicitar troca.')}finally{setBusy(false)}
 };
 const changeMonth=(n:number,goToday=false)=>{if(busy)return;if(Object.keys(draft).length&&!window.confirm('Existem alterações não salvas. Descartar e mudar de mês?'))return;const next=goToday?new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7))-1,1)):new Date(Date.UTC(year,month+n,1));setRows([]);setLoadStatus(demo?'ready':'loading');setYear(next.getUTCFullYear());setMonth(next.getUTCMonth());setDraft({});setUndo([]);setSelection([]);setPicker(false)};
 return <section className="scale-screen scale70 scale1106"><PageHeader page="schedule" title="Escala de Trabalho" description={manager?"Edição da escala e solicitações de colaboradores.":"Consulte seus plantões, folgas e solicitações."} actions={
 <span className="scale-demo">{demo?"Demonstração":!ready?(loadStatus==="loading"?"Consulta em andamento":"Consulta indisponível"):scope==="central"?"Supabase · Sincronizado":"Modo local · Sem sincronização"}</span>
}/>
 <div className={"scale70-toolbar"+(canEdit?" scale96-manager-toolbar":" scale96-reader-toolbar")}><div className="scale96-identity"><strong>{selectedName}</strong><small>{canEdit?'Modo de edição do gestor':'Visualização do colaborador'}</small></div><label>Jornada<strong className="scale95-fixed-model">12×36</strong></label>{canEdit&&<label>Colaborador<RecordFilterDropdown label="Colaborador" placeholder="Selecione o colaborador" required value={target||employeeId} options={teamOptions.map(p=>p.id)} display={id=>teamOptions.find(p=>p.id===id)?.name||'Colaborador'} disabled={busy} onChange={id=>{if(Object.keys(draft).length&&!window.confirm('Descartar alterações não salvas?'))return;setRows([]);setLoadStatus('loading');setTarget(id);setDraft({});setUndo([]);setSelection([])}} hideSelectedOption/></label>}{canEdit&&<><div className="scale96-date-field"><span>Início do ciclo</span><CycleDatePicker value={anchorDate} onChange={setAnchorDate}/></div><button disabled={!ready||busy} onClick={cycle}>Gerar mês pelo ciclo</button></>}</div>
 <div className="scale1106-summary">{totals.map(({label,value,Icon,tone})=><div className={"scale1106-stat "+tone} key={label}><span><Icon size={20}/></span><div><strong>{ready?value:'—'}</strong><small>{label}</small></div></div>)}</div>
 {!ready&&<div className="scale1106-load" role="status"><span>{loadStatus==='loading'?'Consultando escala...':'Consulta indisponível. Confira a conexão antes de alterar os dados.'}</span>{loadStatus==='error'&&<button type="button" onClick={()=>void load()}>Tentar novamente</button>}</div>}
 <div className="scale70-layout"><section className="scale-panel scale-calendar"><div className="scale-panel-head"><h2><CalendarDays size={19}/> Calendário {canEdit?'interativo':'de plantões'}</h2><div className="scale-month"><button className="scale1106-today" type="button" disabled={busy} onClick={()=>changeMonth(0,true)}>Hoje</button><button disabled={busy} onClick={()=>changeMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={18}/></button><strong>{new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month,1)))}</strong><button disabled={busy} onClick={()=>changeMonth(1)} aria-label="Próximo mês"><ChevronRight size={18}/></button></div></div>
 {canEdit&&<p className="scale70-hint">Clique e arraste para selecionar dias · Shift + clique seleciona intervalo · Ctrl + clique alterna dias · Ctrl + Z desfaz</p>}
 <div className="scale70-calendar-anchor" ref={calendarRef}><div className="scale-calendar-grid scale70-grid" onPointerMove={e=>{if(!dragRef.current?.active)return;const element=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-scale-date]');const date=element?.dataset.scaleDate;if(date&&dates.includes(date))hover(date)}}>{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=><span className="scale-weekday" key={d}>{d}</span>)}{Array.from({length:offset},(_,i)=><span key={'empty'+i}/>)}{days.map(day=>{const selected=selection.includes(day.date),changed=day.date in draft;return <button key={day.date} data-scale-date={day.date} type="button" className={'scale-day '+day.kind+(selected?' scale70-selected':'')+(changed?' scale70-dirty':'')+(day.date===today?' scale1106-current':'')} onPointerDown={e=>select(day.date,e)} onPointerUp={release} onClick={e=>{if(!canEdit||!ready)setSelection([day.date]);else if(e.detail===0&&!busy){setSelection([day.date]);lastDateRef.current=day.date;openPicker()}}} onDragStart={e=>e.preventDefault()} aria-current={day.date===today?'date':undefined} aria-pressed={selected} aria-label={nice(day.date)+': '+dayLabel(day)}><span className="scale-day-head"><strong>{Number(day.date.slice(-2))}</strong>{React.createElement(icons[day.kind],{size:15,strokeWidth:1.8,'aria-hidden':true})}</span><span className="scale-day-content"><span className="scale-day-main">{dayLabel(day)}</span><span className="scale-day-mini">{dayLabel(day)}</span></span></button>})}</div>
 {canEdit&&picker&&selection.length>0&&<div ref={pickerRef} className="scale70-picker scale72-floating" style={{top:pickerPosition.top,left:pickerPosition.left}} role="dialog" aria-label="Alterar classificação da escala"><div><strong>{selection.length} dia(s) selecionado(s)</strong><button onClick={()=>{setSelection([]);setPicker(false)}} aria-label="Cancelar seleção"><X size={16}/></button></div><p>Aplicar classificação aos dias selecionados:</p><div className="scale70-options">{kinds.map(k=><button key={k.id} className={k.id} onClick={()=>apply(k.id)}>{React.createElement(icons[k.id],{size:15,strokeWidth:1.8})}<span>{k.name}</span></button>)}</div></div>}
 </div>
 <div className="scale1106-selection" role="status">{selection.length?selection.length+' dia(s) selecionado(s)':'Selecione um dia para consultar'}{selection.length>0&&<button type="button" onClick={()=>{setSelection([]);setPicker(false)}}>Limpar seleção</button>}</div><div className="scale-legend">{kinds.map(k=><span key={k.id} className={"scale78-legend-item "+k.id}>{React.createElement(icons[k.id],{size:14,strokeWidth:1.8})}{k.id==='swap'?'Plantão (troca)':k.name}</span>)}</div></section>
 <aside className="scale-side"><section className="scale-panel scale-detail"><div className="scale-panel-head"><h2><Info size={18}/> Detalhes do dia</h2></div>{active?<><strong className="scale-date">{nice(active.date)}</strong><span className={'scale-tag '+active.kind}>{dayLabel(active)}</span><dl>{active.reason?.startsWith('Troca aprovada')&&<div><dt>Origem</dt><dd>Troca de plantão aprovada</dd></div>}<div><dt>Modelo</dt><dd>{pattern.label}</dd></div><div><dt>Horário</dt><dd>{workKinds.includes(active.kind)?pattern.start+' – '+pattern.end:'Sem plantão'}</dd></div></dl>{!manager&&<button disabled={!ready||busy||demo} className="scale-secondary" onClick={()=>{setSwapDate(active.date);setSwapOpen(true)}}>Solicitar troca</button>}</>:<p>Selecione um dia.</p>}</section>
 <section className="scale-panel scale-requests">
  <div className="scale-panel-head"><h2><ArrowLeftRight size={18}/> Solicitações de troca</h2></div>
  {incoming.some(r=>r.status==='pending'&&r.colleague_response==='pending')&&<p role="status">Você tem solicitações aguardando seu aceite.</p>}
  {incoming.length>0&&<><strong>Pedidos recebidos</strong>{incoming.map(r=><div className="scale70-request" key={'received-'+r.id}>
    <strong>Pedido de {memberName(r.employee_id)}</strong>
    <small>{nice(r.date)}: plantão do solicitante → folga · {r.colleague_work_date?nice(r.colleague_work_date):'Data pendente'}: seu plantão → folga</small>
    <small>Após aprovação, você trabalha em {nice(r.date)} e o solicitante em {r.colleague_work_date?nice(r.colleague_work_date):'data não informada'}.</small>
    <small>Justificativa: {r.reason}</small>
    <small>{r.colleague_response==='accepted'?'Você aceitou':r.colleague_response==='declined'?'Você recusou':'Seu aceite está pendente'} · {r.status==='approved'?'Troca aprovada':r.status==='rejected'?'Encerrada':'Aguardando andamento'}</small>
    {r.status==='pending'&&r.colleague_response==='pending'&&<div><button disabled={busy||!ready} onClick={()=>void respondSwap(r.id,'accepted')}>Aceitar</button><button disabled={busy||!ready} onClick={()=>void respondSwap(r.id,'declined')}>Recusar</button></div>}
   </div>)}</>}
  {manager&&<><strong>Decisões da supervisão</strong>{pending.length===0?<p>Sem solicitações aguardando decisão.</p>:pending.map(r=><div className="scale70-request" key={'manager-'+r.id}>
   <strong>Solicitante: {memberName(r.employee_id)}</strong>
   <small>{nice(r.date)}: {memberName(r.employee_id)} passa de plantão para folga; {memberName(r.colleague_id,r.colleague)} assume o plantão.</small>
   <small>{r.colleague_work_date?nice(r.colleague_work_date):'Data pendente'}: {memberName(r.colleague_id,r.colleague)} passa de plantão para folga; {memberName(r.employee_id)} assume o plantão.</small>
   <small>Justificativa: {r.reason}</small>
   <small>{r.colleague_response==='accepted'?'Aceite do colega confirmado':r.colleague_response==='declined'?'Colega recusou':'Aguardando aceite do colega'}</small>
   <div><button disabled={busy||!ready||r.colleague_response!=='accepted'||employeeId===r.employee_id||employeeId===r.colleague_id} title={r.colleague_response!=='accepted'?'Aguardar concordância do colega':'Confirmar troca de ambos os colaboradores'} onClick={()=>void decide(r.id,'approved')}>Aprovar</button>
   <button disabled={busy||!ready||employeeId===r.employee_id||employeeId===r.colleague_id} onClick={()=>void decide(r.id,'rejected')}>Recusar</button></div>
  </div>)}</>}
  <strong>Minhas solicitações</strong>
  {requests.length===0?<p>Nenhuma solicitação cadastrada.</p>:requests.map(r=><div className="scale70-request" key={'mine-'+r.id}>
   <strong>{nice(r.date)} — Troca com: {memberName(r.colleague_id,r.colleague)}</strong>
   <small>{nice(r.date)}: seu plantão → folga · {r.colleague_work_date?nice(r.colleague_work_date):'Data pendente'}: folga → plantão (troca)</small>
   <small>Justificativa: {r.reason}</small>
   <small>{r.status==='approved'?'Aprovada':r.status==='rejected'?'Recusada/encerrada':r.colleague_response==='accepted'?'Aceita pelo colega — aguardando gestor':'Aguardando colega'}</small>
  </div>)}
 </section>
 <section className="scale76-export"><strong>Exportar escala individual</strong><p>Arquivo mensal com identificação, resumo e classificação dos dias.</p><div><button type="button" disabled={!ready||busy||Object.keys(draft).length>0} onClick={()=>void exportSchedule('xlsx')}>Exportar Excel</button><button type="button" disabled={!ready||busy||Object.keys(draft).length>0} onClick={()=>void exportSchedule('pdf')}>Exportar PDF</button></div></section>
 {canEdit&&<div className="scale70-save"><span>{Object.keys(draft).length} alteração(ões) pendente(s)</span><div><button disabled={!undo.length} onClick={()=>{setDraft(undo[undo.length-1]);setUndo(u=>u.slice(0,-1))}}><Undo2 size={16}/> Desfazer</button><button className="scale70-primary" disabled={!ready||!Object.keys(draft).length||busy||!target} onClick={()=>{setSaveError('');setConfirm(true)}}><Save size={16}/> Salvar escala</button></div></div>}
 </aside></div>
 {message&&<div className="scale-feedback" role="status"><Info size={17}/>{message}<button onClick={()=>setMessage('')} aria-label="Fechar aviso"><X size={16}/></button></div>}
 {confirm&&<div className="scale-overlay"><div className="scale-dialog scale70-confirm" role="alertdialog" aria-modal="true" aria-label="Confirmar alterações"><h2>Salvar alterações da escala?</h2><p>Serão atualizados {Object.keys(draft).length} dia(s) de {selectedName}. Datas já cadastradas serão substituídas. A gravação seguirá o modo de armazenamento indicado na escala.</p>{saveError&&<p className="scale96-save-error" role="alert"><AlertTriangle size={17}/>{saveError}</p>}<div className="scale-dialog-actions"><button onClick={()=>setConfirm(false)}>Cancelar</button><button className="scale70-primary" disabled={busy||!ready} onClick={()=>void save()}>Confirmar</button></div></div></div>}
 {swapOpen&&<div className="scale-overlay"><form className="scale-dialog" role="dialog" aria-modal="true" aria-label="Solicitação de troca" onSubmit={submitSwap} onKeyDown={e=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();setSwapOpen(false)}}}>
  <h2>Solicitar troca — {nice(swapDate)}</h2>
  <p>Seu plantão de {nice(swapDate)} será uma <strong>folga</strong> e você assumirá o plantão do colega na outra data, após os aceites e a aprovação.</p>
  {scope==='central'?<>
   <label>Colaborador da mesma central<RecordFilterDropdown label="Colaborador da mesma central" placeholder="Selecione o colega" required value={peerId} options={peers.map(p=>p.id)} display={id=>peers.find(p=>p.id===id)?.name||'Colaborador'} onChange={setPeerId} hideSelectedOption/></label>
   <div className="scale109-swap-field"><SwapCalendar109 value={peerDate} onChange={setPeerDate} minDate={new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())} excludeDate={swapDate}/></div>
   <p>Os dois plantões precisam estar cadastrados na escala central, com trabalho/folga correspondentes. A troca só ocorre após os dois aceites e a decisão do supervisor.</p>
  </>:<label>Colaborador<input required maxLength={80} value={colleague} onChange={e=>setColleague(e.target.value)}/></label>}
  <label>Justificativa<textarea required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
  <div className="scale-dialog-actions"><button type="button" onClick={()=>setSwapOpen(false)}>Cancelar</button><button disabled={busy||!ready||scope==='central'&&(!peerId||!peerDate)}>Enviar solicitação</button></div>
 </form></div>}
 <div className="scale-disclaimer"><AlertTriangle size={16}/>{scope==='central'?'Trocas exigem aceite do colega e aprovação independente do gestor. Dados são compartilhados apenas com usuários autorizados da mesma central.':'Modo local: solicitações e escalas não são sincronizadas entre computadores.'}</div></section>
}
