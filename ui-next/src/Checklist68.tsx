import { PageHeader, PageAction } from "./PageHeader";
import React,{useEffect,useRef,useState} from 'react';
import {ClipboardList,CheckCircle2,Clock3,Plus,RefreshCw,AlertCircle,AlertTriangle,Bell,Search,ChevronDown,CalendarDays,Settings2,Check,Cloud,Monitor} from 'lucide-react';
import './checklist68.css';
import RecordFilterDropdown from './RecordFilterDropdown';
import ReminderTimePicker98 from './ReminderTimePicker98';
import RoutineDatePicker99 from './RoutineDatePicker99';

type Task={id:string;title:string;period:string;reminder_time?:string|null;recurrence?:string;scheduled_date?:string|null;weekday?:number|null};
const FREQ=[{id:'daily',label:'Todos os dias'},{id:'weekdays',label:'Dias úteis (seg–sex)'},{id:'weekly',label:'Dia da semana'},{id:'once',label:'Uma vez só'},{id:'date',label:'Data específica'}];
const WEEKDAYS=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const localToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const activeDay=(t:Task,date=localToday())=>{const r=t.recurrence||'daily',w=new Date(date+'T12:00:00Z').getUTCDay();return r==='daily'||r==='weekdays'&&w>=1&&w<=5||r==='weekly'&&Number(t.weekday)===w||(r==='once'||r==='date')&&t.scheduled_date===date};
export default function Checklist68({role,demo,initialTaskId,onTaskHandled}:{role:string;demo:boolean;initialTaskId?:string|null;onTaskHandled?:()=>void}){
 const manager=role==='admin'||role==='supervisor';
 const descriptionRef=useRef<HTMLInputElement>(null);
 const [scope,setScope]=useState('local');
 const [taskFocus,setTaskFocus]=useState<string|null>(null);
 const [query,setQuery]=useState(''),[view,setView]=useState('all'),[periodView,setPeriodView]=useState('current'),[editorOpen,setEditorOpen]=useState(false),[catalogOpen,setCatalogOpen]=useState(false);
 const [date,setDate]=useState(localToday),[now,setNow]=useState(()=>new Date()),[loading,setLoading]=useState(true),[fresh,setFresh]=useState(false);
 const alive=useRef(false),reading=useRef<Promise<boolean>|null>(null),writing=useRef(false);
 const editorRef=useRef<HTMLFormElement>(null);
 const [tasks,setTasks]=useState<Task[]>([]),[done,setDone]=useState<string[]>([]);
 const [title,setTitle]=useState(''),[period,setPeriod]=useState('Todos'),[reminderTime,setReminderTime]=useState(''),[recurrence,setRecurrence]=useState('daily'),[scheduledDate,setScheduledDate]=useState(localToday()),[weekday,setWeekday]=useState('1');
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [disableTarget,setDisableTarget]=useState<Task|null>(null);
 const [editing,setEditing]=useState<Task|null>(null);
 const api=window.mopDesktop?.checklist68;
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(now));
 const currentPeriod=hour>=6&&hour<18?'Diurno':'Noturno';
 const selectedPeriod=periodView==='current'?currentPeriod:periodView;
 const todayTasks=tasks.filter(t=>activeDay(t,date));
 const periodTasks=todayTasks.filter(t=>selectedPeriod==='all'||t.period==='Todos'||t.period===selectedPeriod);
 const completed=periodTasks.filter(t=>done.includes(t.id)).length,pending=periodTasks.length-completed;
 const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const matches=(t:Task)=>(!taskFocus||t.id===taskFocus)&&normalize(t.title).includes(normalize(query));
 const visibleTasks=periodTasks.filter(t=>matches(t)&&(view==='all'||(view==='done')===done.includes(t.id))).sort((a,b)=>Number(done.includes(a.id))-Number(done.includes(b.id))||(a.reminder_time||'99:99').localeCompare(b.reminder_time||'99:99')||a.title.localeCompare(b.title,'pt-BR'));
 const otherTasks=tasks.filter(t=>!periodTasks.includes(t));
 const dateLabel=date.split('-').reverse().join('/');
 const validDate=date===localToday();
 const blocked=busy||loading||!fresh||!validDate;
 useEffect(()=>{if(!initialTaskId||!fresh)return;const task=tasks.find(t=>t.id===initialTaskId);if(task){setTaskFocus(task.id);setQuery(task.title);setView('all');setPeriodView('all')}onTaskHandled?.()},[initialTaskId,fresh,tasks,onTaskHandled]);
 const openEditor=()=>{setEditorOpen(true);requestAnimationFrame(()=>{descriptionRef.current?.focus({preventScroll:true});const form=editorRef.current,main=form?.closest('.ref-main');if(form&&main){main.scrollTop+=form.getBoundingClientRect().top-main.getBoundingClientRect().top-12}})};
 const editTask=(task:Task)=>{setEditing(task);setTitle(task.title);setPeriod(task.period);setReminderTime(task.reminder_time?.slice(0,5)||'');setRecurrence(task.recurrence||'daily');setScheduledDate(task.scheduled_date||localToday());setWeekday(String(task.weekday??1));setError('');setMessage('');openEditor()};
 const resetEditor=()=>{setEditing(null);setTitle('');setPeriod('Todos');setReminderTime('');setRecurrence('daily');setScheduledDate(localToday());setWeekday('1')};
 const load=async():Promise<boolean>=>{if(demo)return false;if(reading.current)return reading.current;const request=(async()=>{if(alive.current)setLoading(true);try{if(!api)throw Error('Checklist indisponível nesta instalação.');const result=await api('list');if(!alive.current)return false;setScope(result.scope||'local');setTasks(result.tasks||[]);setDone((result.runs||[]).map((x:{task_id:string})=>String(x.task_id)));setDate(result.date||localToday());setFresh(true);setError('');return true}catch(e){if(alive.current){setFresh(false);setError(e instanceof Error?e.message:'Falha ao consultar rotinas.')}return false}finally{if(alive.current)setLoading(false)}})();reading.current=request;try{return await request}finally{if(reading.current===request)reading.current=null}};
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false}},[demo]);
 useEffect(()=>{if(demo)return;return window.mopDesktop?.onSync?.(state=>{if(state?.dataChanged&&!writing.current)void load()})},[demo]);
 useEffect(()=>{if(demo)return;const timer=window.setInterval(()=>{setNow(new Date());if(!writing.current)void load()},20000);return()=>window.clearInterval(timer)},[demo]);
 useEffect(()=>{if(!disableTarget)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)setDisableTarget(null)};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[disableTarget,busy]);
 const mutate=async(action:string,input:object,success:string,after?:()=>void)=>{if(blocked||writing.current||reading.current||demo||!api)return;writing.current=true;setBusy(true);setError('');setMessage('');try{await api(action,input);if(!alive.current)return;after?.();const refreshed=await load();if(alive.current)setMessage(refreshed?success:'Operação registrada; atualize a lista para conferir o estado atual.')}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Não foi possível executar a operação.')}finally{writing.current=false;if(alive.current)setBusy(false)}};
 const run=async(id:string)=>{if(!periodTasks.some(t=>t.id===id)||done.includes(id)||role==='viewer')return;await mutate('complete',{id},scope==='central'?'Rotina concluída para toda a equipe.':'Rotina concluída nesta estação.')};
 const add=async(e:React.FormEvent)=>{e.preventDefault();if(!manager||!title.trim())return;await mutate(editing?'edit':'create',{id:editing?.id,title:title.trim(),period,reminder_time:reminderTime||null,recurrence,scheduled_date:['once','date'].includes(recurrence)?scheduledDate:null,weekday:recurrence==='weekly'?Number(weekday):null},editing?'Rotina atualizada com sucesso.':'Rotina cadastrada com sucesso.',()=>{resetEditor();setEditorOpen(false)})};
 const disable=async()=>{if(!manager||!disableTarget)return;await mutate('disable',{id:disableTarget.id},'Rotina desativada. Histórico preservado.',()=>setDisableTarget(null))};
 const testPopup=async()=>{setBusy(true);setError('');setMessage('');try{if(!window.mopDesktop?.reminderTest97)throw Error('Teste de lembrete indisponível. Atualize o aplicativo.');await window.mopDesktop.reminderTest97();setMessage('Solicitação de teste enviada. Confira a janela do lembrete acima dos demais programas.')}catch(e){setError(e instanceof Error?e.message:'Falha ao abrir lembrete de teste.')}finally{setBusy(false)}};
 return <section className="check68 check1104">
  <PageHeader page="routines" title="Checklists e Rotinas" description="Organize e acompanhe as atividades do plantão." actions={<>
   <PageAction kind="refresh" onClick={()=>void load()} disabled={busy||loading||demo}>{loading?"Atualizando…":"Atualizar"}</PageAction>
   {manager&&!demo&&<PageAction kind="create" primary={!editorOpen} disabled={busy} onClick={()=>editorOpen?setEditorOpen(false):openEditor()}>{editorOpen?"Ocultar cadastro":"Nova rotina"}</PageAction>}
  </>}/>
  {demo?<div className="check68-empty"><AlertCircle size={24}/><strong>Ambiente demonstrativo</strong><p>Nenhuma rotina real é carregada ou alterada nesta conta.</p></div>:<>
   <div className="check1104-context"><span><CalendarDays size={16}/> {dateLabel} · Plantão {currentPeriod.toLowerCase()}</span><span>{scope==='central'?<Cloud size={15}/>:<Monitor size={15}/>} {fresh?(scope==='central'?'Central conectada':'Dados locais nesta estação'):loading?'Consultando dados':'Dados não confirmados'}</span></div>
   <div className="check68-summary">{[{id:'all',label:'Previstas',value:periodTasks.length,Icon:ClipboardList},{id:'pending',label:'Pendentes',value:pending,Icon:Clock3},{id:'done',label:'Concluídas',value:completed,Icon:CheckCircle2}].map(({id,label,value,Icon})=><div key={id} className={'check1104-metric '+id}><button type="button" aria-pressed={view===id} onClick={()=>setView(id)}><Icon size={20}/><strong>{fresh?value:'—'}</strong><span>{label}</span></button></div>)}</div>
   <div className="check1104-progress"><div><strong>Progresso do período selecionado</strong><span>{fresh?`${completed} de ${periodTasks.length} concluídas`:'Aguardando consulta'}</span></div><progress aria-label="Progresso das rotinas" value={fresh?completed:0} max={periodTasks.length||1}/></div>
   {error&&<p role="alert" className="check68-error">{error}</p>}{message&&<p role="status" className="check68-success">{message}</p>}
   {!validDate&&<p role="status" className="check68-warning">O dia mudou. Atualize a consulta antes de registrar atividades.</p>}
   {manager&&editorOpen&&<form ref={editorRef} className="check68-form check98-form" onSubmit={add}>
     <h2>{editing?'Editar rotina':'Cadastrar rotina'}</h2>
     <div className="check98-fields">
      <label className="check98-field"><span>Descrição</span><input ref={descriptionRef} required maxLength={120} autoComplete="off" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Nome da atividade"/></label>
      <div className="check98-field"><span>Período</span><RecordFilterDropdown label="Período" placeholder="Período" value={period} options={['Todos','Diurno','Noturno']} onChange={setPeriod}/></div>
      <div className="check98-field"><span>Horário do lembrete</span><ReminderTimePicker98 value={reminderTime} onChange={setReminderTime} disabled={busy}/></div>
      <div className="check98-field"><span>Frequência</span><RecordFilterDropdown label="Frequência" value={recurrence} options={FREQ.map(x=>x.id)} display={id=>FREQ.find(x=>x.id===id)?.label||id} onChange={setRecurrence}/></div>
      {recurrence==='weekly'&&<div className="check98-field"><span>Dia da semana</span><RecordFilterDropdown label="Dia da semana" value={weekday} options={WEEKDAYS.map((_,i)=>String(i))} display={id=>WEEKDAYS[Number(id)]} onChange={setWeekday}/></div>}
      {['once','date'].includes(recurrence)&&<div className="check98-field"><span>Data da rotina</span><RoutineDatePicker99 value={scheduledDate} onChange={setScheduledDate} disabled={busy}/></div>}
      <button className="check98-add" type="submit" disabled={blocked||!title.trim()||(['once','date'].includes(recurrence)&&!scheduledDate)}><Plus size={16}/> {editing?'Salvar alterações':'Adicionar'}</button>
     </div>
     <div className="check98-form-footer"><span>Horário opcional · fuso de Brasília (SP). O MOP precisa estar em execução para exibir o alerta.</span><div className="check99-footer-actions"><button type="button" className="check99-cancel-edit" disabled={busy} onClick={()=>{resetEditor();setEditorOpen(false)}}>Cancelar</button><button type="button" className="check98-test" disabled={busy} onClick={()=>void testPopup()}><Bell size={15}/> Testar popup</button></div></div>
    </form>}
   <div className="check68-list"><div className="check1104-list-head"><div><h2>Rotinas do período</h2><p>Priorize as pendentes e acompanhe a execução da equipe.</p></div><span>{visibleTasks.length} atividades</span></div><div className="check1104-toolbar"><label className="check1104-search"><Search size={17}/><input aria-label="Pesquisar atividade" placeholder="Pesquisar atividade..." value={query} onChange={e=>{setTaskFocus(null);setQuery(e.target.value)}}/></label><RecordFilterDropdown label="Filtrar período" value={periodView} options={['current','all','Diurno','Noturno']} display={id=>id==='current'?'Plantão atual':id==='all'?'Todos os períodos':id} onChange={setPeriodView}/></div><div className="check1104-filters" aria-label="Situação das rotinas">{[['all','Todas'],['pending','Pendentes'],['done','Concluídas']].map(([id,label])=><button type="button" key={id} aria-pressed={view===id} onClick={()=>setView(id)}>{label}</button>)}{(query||view!=='all'||periodView!=='current')&&<button type="button" onClick={()=>{setTaskFocus(null);setQuery('');setView('all');setPeriodView('current')}}>Limpar filtros</button>}</div>
   {loading&&!fresh?<div className="check68-empty"><RefreshCw size={24}/><strong>Consultando rotinas</strong></div>:!fresh&&!tasks.length?<div className="check68-empty"><AlertCircle size={24}/><strong>Consulta indisponível</strong><p>Atualize para consultar as atividades.</p></div>:!visibleTasks.length?<div className="check68-empty"><Clock3 size={24}/><strong>{periodTasks.length?'Nenhuma atividade neste filtro':'Nenhuma rotina prevista para o período'}</strong><p>{periodTasks.length?'Altere os filtros para consultar outras atividades.':'Consulte outros períodos ou aguarde novas atividades.'}</p></div>:visibleTasks.map(task=><div key={task.id} className={'check68-item check1104-task '+(done.includes(task.id)?'is-done':'')}><span className={'check1104-task-icon '+(done.includes(task.id)?'complete':'')}>{done.includes(task.id)?<CheckCircle2 size={22}/>:<Clock3 size={22}/>}</span><div><strong>{task.title}</strong><small>{task.period} · {FREQ.find(x=>x.id===(task.recurrence||'daily'))?.label||'Todos os dias'}{task.recurrence==='weekly'&&task.weekday!=null?' · '+WEEKDAYS[task.weekday]:''}</small><small>{task.reminder_time?'Lembrete às '+task.reminder_time.slice(0,5)+' · ':''}{done.includes(task.id)?'Concluída pela equipe':'Aguardando execução'}</small></div>{!done.includes(task.id)&&role!=='viewer'&&<button className="check1104-primary" type="button" disabled={blocked} onClick={()=>void run(task.id)}><Check size={16}/>Concluir</button>}{manager&&<><button type="button" className="check68-secondary" disabled={blocked} onClick={()=>editTask(task)}>Editar</button><button type="button" className="check68-secondary" disabled={blocked} onClick={()=>{setMessage('');setDisableTarget(task)}}>Desativar</button></>}</div>)}
   </div>
   {manager&&<div className="check68-list check1104-catalog"><button type="button" className="check1104-catalog-toggle" aria-expanded={catalogOpen} onClick={()=>setCatalogOpen(!catalogOpen)}><Settings2 size={18}/><span>Outras rotinas cadastradas ({otherTasks.length})</span><ChevronDown size={16}/></button>{catalogOpen&&<>{otherTasks.length===0?<p className="check68-warning">Nenhuma outra atividade cadastrada.</p>:otherTasks.filter(matches).map(task=><div key={task.id} className="check68-item"><Clock3 size={18}/><div><strong>{task.title}</strong><small>{task.period} · {FREQ.find(x=>x.id===(task.recurrence||'daily'))?.label||'Todos os dias'}{task.scheduled_date?' · '+task.scheduled_date.split('-').reverse().join('/'):''}{task.reminder_time?' · '+task.reminder_time.slice(0,5):''}</small></div><button type="button" className="check68-secondary" disabled={blocked} onClick={()=>editTask(task)}>Editar</button><button type="button" className="check68-secondary" disabled={blocked} onClick={()=>setDisableTarget(task)}>Desativar</button></div>)}</>}</div>}
   <p className="check68-warning">{scope==='central'?'Rotinas e execuções sincronizadas com a central Supabase. A conclusão é registrada por colaborador.':'Modo local: rotinas disponíveis apenas neste computador, sem sincronização com a central.'}</p>
  </>}
  {disableTarget&&<div className="check98-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setDisableTarget(null)}}>
   <div className="check98-dialog" role="alertdialog" aria-modal="true" aria-labelledby="check98-dialog-title" aria-describedby="check98-dialog-desc">
    <div className="check98-dialog-icon"><AlertTriangle size={23}/></div><h2 id="check98-dialog-title">Desativar rotina?</h2><p id="check98-dialog-desc">A rotina <strong>{disableTarget.title}</strong> deixará de aparecer na programação. As execuções anteriores continuarão preservadas.</p>
    <div className="check98-dialog-actions"><button type="button" disabled={busy} onClick={()=>setDisableTarget(null)}>Cancelar</button><button className="check98-confirm" type="button" disabled={blocked} onClick={()=>void disable()}>{busy?'Desativando...':'Confirmar desativação'}</button></div>
   </div>
  </div>}
 </section>;
}
