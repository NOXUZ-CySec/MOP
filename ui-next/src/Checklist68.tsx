import React,{useEffect,useRef,useState} from 'react';
import {ClipboardList,CheckCircle2,Clock3,Plus,RefreshCw,AlertCircle,AlertTriangle,Bell} from 'lucide-react';
import './checklist68.css';
import RecordFilterDropdown from './RecordFilterDropdown';
import ReminderTimePicker98 from './ReminderTimePicker98';
import RoutineDatePicker99 from './RoutineDatePicker99';

type Task={id:string;title:string;period:string;reminder_time?:string|null;recurrence?:string;scheduled_date?:string|null;weekday?:number|null};
const FREQ=[{id:'daily',label:'Todos os dias'},{id:'weekdays',label:'Dias úteis (seg–sex)'},{id:'weekly',label:'Dia da semana'},{id:'once',label:'Uma vez só'},{id:'date',label:'Data específica'}];
const WEEKDAYS=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const localToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const activeDay=(t:Task,date=localToday())=>{const r=t.recurrence||'daily',w=new Date(date+'T12:00:00Z').getUTCDay();return r==='daily'||r==='weekdays'&&w>=1&&w<=5||r==='weekly'&&Number(t.weekday)===w||(r==='once'||r==='date')&&t.scheduled_date===date};
export default function Checklist68({role,demo}:{role:string;demo:boolean}){
 const manager=role==='admin'||role==='supervisor';
 const descriptionRef=useRef<HTMLInputElement>(null);
 const [scope,setScope]=useState('local');
 const [tasks,setTasks]=useState<Task[]>([]),[done,setDone]=useState<string[]>([]);
 const [title,setTitle]=useState(''),[period,setPeriod]=useState('Todos'),[reminderTime,setReminderTime]=useState(''),[recurrence,setRecurrence]=useState('daily'),[scheduledDate,setScheduledDate]=useState(localToday()),[weekday,setWeekday]=useState('1');
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [disableTarget,setDisableTarget]=useState<Task|null>(null);
 const [editing,setEditing]=useState<Task|null>(null);
 const api=window.mopDesktop?.checklist68;
 const todayTasks=tasks.filter(t=>activeDay(t));
 const otherTasks=tasks.filter(t=>!activeDay(t));
 const editTask=(task:Task)=>{setEditing(task);setTitle(task.title);setPeriod(task.period);setReminderTime(task.reminder_time?.slice(0,5)||'');setRecurrence(task.recurrence||'daily');setScheduledDate(task.scheduled_date||localToday());setWeekday(String(task.weekday??1));setError('');setMessage('');requestAnimationFrame(()=>descriptionRef.current?.focus())};
 const resetEditor=()=>{setEditing(null);setTitle('');setPeriod('Todos');setReminderTime('');setRecurrence('daily');setScheduledDate(localToday());setWeekday('1')};
 const load=async()=>{if(demo)return;try{if(!api)throw Error('Checklist indisponível nesta instalação.');const result=await api('list');setScope(result.scope||'local');setTasks(result.tasks||[]);setDone((result.runs||[]).map((x:{task_id:string})=>x.task_id));setError('')}catch(e){setError(e instanceof Error?e.message:'Falha ao consultar rotinas.')}};
 useEffect(()=>{void load()},[demo]);
 useEffect(()=>{if(demo)return;return window.mopDesktop?.onSync?.(state=>{if(state?.dataChanged)void load()})},[demo]);
 useEffect(()=>{if(demo)return;const timer=window.setInterval(()=>void load(),20000);return()=>window.clearInterval(timer)},[demo]);
 useEffect(()=>{if(!disableTarget)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)setDisableTarget(null)};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[disableTarget,busy]);
 const run=async(id:string)=>{setBusy(true);setError('');try{await api!('complete',{id});await load();setMessage('Rotina concluída para toda a equipe.')}catch(e){setError(e instanceof Error?e.message:'Falha ao concluir rotina.')}finally{setBusy(false)}};
 const add=async(e:React.FormEvent)=>{e.preventDefault();if(!title.trim()||busy)return;setBusy(true);setError('');setMessage('');try{await api!(editing?'edit':'create',{id:editing?.id,title:title.trim(),period,reminder_time:reminderTime||null,recurrence,scheduled_date:['once','date'].includes(recurrence)?scheduledDate:null,weekday:recurrence==='weekly'?Number(weekday):null});const wasEditing=!!editing;resetEditor();await load();setMessage(wasEditing?'Rotina atualizada com sucesso.':'Rotina cadastrada com sucesso.')}catch(e){setError(e instanceof Error?e.message:'Falha ao criar rotina.')}finally{setBusy(false)}};
 const disable=async()=>{if(!disableTarget||busy)return;setBusy(true);setError('');try{await api!('disable',{id:disableTarget.id});setDisableTarget(null);await load();setMessage('Rotina desativada. Você pode cadastrar novas atividades.')}catch(e){setError(e instanceof Error?e.message:'Falha ao desativar rotina.')}finally{setBusy(false);requestAnimationFrame(()=>descriptionRef.current?.focus())}};
 const testPopup=async()=>{setBusy(true);setError('');setMessage('');try{if(!window.mopDesktop?.reminderTest97)throw Error('Teste de lembrete indisponível. Atualize o aplicativo.');await window.mopDesktop.reminderTest97();setMessage('Solicitação de teste enviada. Confira a janela do lembrete acima dos demais programas.')}catch(e){setError(e instanceof Error?e.message:'Falha ao abrir lembrete de teste.')}finally{setBusy(false)}};
 return <section className="check68">
  <header><div><ClipboardList size={30}/><span><h1>Checklist e Rotinas</h1><p>Atividades previstas e execuções do período, sem duplicar ocorrências.</p></span></div><button type="button" onClick={()=>void load()} disabled={busy||demo}><RefreshCw size={16}/> Atualizar</button></header>
  {demo?<div className="check68-empty"><AlertCircle size={24}/><strong>Ambiente demonstrativo</strong><p>Nenhuma rotina real é carregada ou alterada nesta conta.</p></div>:<>
   <div className="check68-summary"><div><strong>{tasks.length}</strong><span>Rotinas cadastradas</span></div><div><strong>{todayTasks.filter(x=>done.includes(x.id)).length}</strong><span>Concluídas hoje pela equipe</span></div><div><strong>{todayTasks.filter(x=>!done.includes(x.id)).length}</strong><span>Aguardando execução</span></div></div>
   {error&&<p role="alert" className="check68-error">{error}</p>}{message&&<p role="status" className="check68-success">{message}</p>}
   {manager&&<form className="check68-form check98-form" onSubmit={add}>
     <h2>{editing?'Editar rotina':'Gerenciar rotinas'}</h2>
     <div className="check98-fields">
      <label className="check98-field"><span>Descrição</span><input ref={descriptionRef} required maxLength={120} autoComplete="off" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Nome da atividade"/></label>
      <div className="check98-field"><span>Período</span><RecordFilterDropdown label="Período" placeholder="Período" value={period} options={['Todos','Diurno','Noturno']} onChange={setPeriod}/></div>
      <div className="check98-field"><span>Horário do lembrete</span><ReminderTimePicker98 value={reminderTime} onChange={setReminderTime} disabled={busy}/></div>
      <div className="check98-field"><span>Frequência</span><RecordFilterDropdown label="Frequência" value={recurrence} options={FREQ.map(x=>x.id)} display={id=>FREQ.find(x=>x.id===id)?.label||id} onChange={setRecurrence}/></div>
      {recurrence==='weekly'&&<div className="check98-field"><span>Dia da semana</span><RecordFilterDropdown label="Dia da semana" value={weekday} options={WEEKDAYS.map((_,i)=>String(i))} display={id=>WEEKDAYS[Number(id)]} onChange={setWeekday}/></div>}
      {['once','date'].includes(recurrence)&&<div className="check98-field"><span>Data da rotina</span><RoutineDatePicker99 value={scheduledDate} onChange={setScheduledDate} disabled={busy}/></div>}
      <button className="check98-add" type="submit" disabled={busy||!title.trim()||(['once','date'].includes(recurrence)&&!scheduledDate)}><Plus size={16}/> {editing?'Salvar alterações':'Adicionar'}</button>
     </div>
     <div className="check98-form-footer"><span>Horário opcional · fuso de Brasília (SP). O MOP precisa estar em execução para exibir o alerta.</span><div className="check99-footer-actions">{editing&&<button type="button" className="check99-cancel-edit" disabled={busy} onClick={resetEditor}>Cancelar edição</button>}<button type="button" className="check98-test" disabled={busy} onClick={()=>void testPopup()}><Bell size={15}/> Testar popup</button></div></div>
    </form>}
   <div className="check68-list"><h2>Rotinas deste período</h2>{todayTasks.length===0?<div className="check68-empty"><Clock3 size={24}/><strong>Nenhuma rotina prevista para hoje</strong><p>A supervisão pode cadastrar atividades com horário e frequência.</p></div>:todayTasks.map(task=><div key={task.id} className="check68-item"><span className={done.includes(task.id)?'complete':''}><CheckCircle2 size={20}/></span><div><strong>{task.title}</strong><small>{task.period} · {FREQ.find(x=>x.id===(task.recurrence||'daily'))?.label||'Todos os dias'} · {task.reminder_time?'Lembrete às '+task.reminder_time.slice(0,5)+' · ':''}{done.includes(task.id)?'Concluída pela equipe':'Aguardando execução'}</small></div>{!done.includes(task.id)&&<button type="button" disabled={busy} onClick={()=>void run(task.id)}>Concluir</button>}{manager&&<><button type="button" className="check68-secondary" disabled={busy} onClick={()=>editTask(task)}>Editar</button><button type="button" className="check68-secondary" disabled={busy} onClick={()=>{setMessage('');setDisableTarget(task)}}>Desativar</button></>}</div>)}{manager&&otherTasks.length>0&&<><h2 className="check99-other-title">Outras rotinas cadastradas</h2>{otherTasks.map(task=><div key={task.id} className="check68-item"><Clock3 size={18}/><div><strong>{task.title}</strong><small>{task.period} · {FREQ.find(x=>x.id===(task.recurrence||'daily'))?.label||'Todos os dias'}{task.scheduled_date?' · '+task.scheduled_date.split('-').reverse().join('/'):''}{task.reminder_time?' · '+task.reminder_time.slice(0,5):''}</small></div><button type="button" className="check68-secondary" disabled={busy} onClick={()=>editTask(task)}>Editar</button><button type="button" className="check68-secondary" disabled={busy} onClick={()=>setDisableTarget(task)}>Desativar</button></div>)}</>}</div>
   <p className="check68-warning">{scope==='central'?'Rotinas e execuções sincronizadas com a central Supabase. A conclusão é registrada por colaborador.':'Modo local: rotinas disponíveis apenas neste computador, sem sincronização com a central.'}</p>
  </>}
  {disableTarget&&<div className="check98-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setDisableTarget(null)}}>
   <div className="check98-dialog" role="alertdialog" aria-modal="true" aria-labelledby="check98-dialog-title" aria-describedby="check98-dialog-desc">
    <div className="check98-dialog-icon"><AlertTriangle size={23}/></div><h2 id="check98-dialog-title">Desativar rotina?</h2><p id="check98-dialog-desc">A rotina <strong>{disableTarget.title}</strong> deixará de aparecer na programação. As execuções anteriores continuarão preservadas.</p>
    <div className="check98-dialog-actions"><button type="button" disabled={busy} onClick={()=>setDisableTarget(null)}>Cancelar</button><button className="check98-confirm" type="button" disabled={busy} onClick={()=>void disable()}>{busy?'Desativando...':'Confirmar desativação'}</button></div>
   </div>
  </div>}
 </section>;
}
