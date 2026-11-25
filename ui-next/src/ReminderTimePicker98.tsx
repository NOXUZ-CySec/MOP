import React,{useEffect,useRef,useState} from 'react';
import {Clock3,ChevronDown,Check} from 'lucide-react';
import './reminder-time-picker98.css';

type Props={value:string;onChange:(next:string)=>void;disabled?:boolean};
const HOURS=Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));
const MINUTES=Array.from({length:60},(_,i)=>String(i).padStart(2,'0'));
function normalize(text:string):string|null{
 const compact=text.trim().replace(/\s/g,'');
 if(!compact)return '';
 const m=/^([01]?\d|2[0-3]):([0-5]\d)$/.exec(compact);
 if(m)return m[1].padStart(2,'0')+':'+m[2];
 const digits=/^(\d{1,2})(\d{2})$/.exec(compact);
 if(digits&&Number(digits[1])<24&&Number(digits[2])<60)return digits[1].padStart(2,'0')+':'+digits[2];
 return null;
}
export default function ReminderTimePicker98({value,onChange,disabled=false}:Props){
 const [open,setOpen]=useState(false);
 const [hour,setHour]=useState('06'),[minute,setMinute]=useState('00');
 const [draft,setDraft]=useState(value||''),[invalid,setInvalid]=useState(false);
 const root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{setDraft(value||'');setInvalid(false)},[value]);
 useEffect(()=>{if(!open)return;const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(normalize(draft)||'');setHour(m?.[1]||'06');setMinute(m?.[2]||'00')},[open]);
 useEffect(()=>{
  if(!open)return;
  const outside=(e:PointerEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setOpen(false)};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);input.current?.focus()}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}
 },[open]);
 const commit=()=>{
  const next=normalize(draft);
  if(next===null){setInvalid(true);return false}
  setInvalid(false);setDraft(next);if(next!==value)onChange(next);return true;
 };
 const apply=()=>{const next=hour+':'+minute;setDraft(next);setInvalid(false);onChange(next);setOpen(false);input.current?.focus()};
 return <div className={'check98-time'+(open?' open':'')+(invalid?' invalid':'')} ref={root}>
  <div className="check98-time-entry">
   <Clock3 size={16} aria-hidden="true"/>
   <input ref={input} type="text" inputMode="numeric" maxLength={5} autoComplete="off" spellCheck={false}
    value={draft} disabled={disabled} placeholder="HH:MM" aria-label="Horário do lembrete, digite HH:MM"
    aria-invalid={invalid} aria-describedby={invalid?'check98-time-error':undefined}
    onChange={e=>{setDraft(e.target.value.replace(/[^\d:]/g,''));setInvalid(false)}}
    onBlur={()=>{if(draft!==value)commit()}}
    onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(commit())input.current?.blur()}}}/>
   <button type="button" className="check98-time-toggle" disabled={disabled} aria-label="Abrir seletor de horário"
    aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(x=>!x)}>
    <ChevronDown size={16} className="check98-time-chevron"/>
   </button>
  </div>
  {invalid&&<small id="check98-time-error" className="check98-time-error" role="alert">Use um horário válido (00:00 a 23:59).</small>}
  {open&&<div className="check98-time-popover" role="dialog" aria-label="Selecionar horário do lembrete">
   <div className="check98-time-head"><Clock3 size={16}/><strong>Horário do lembrete</strong></div>
   <div className="check98-time-columns">
    <div><span className="check98-time-caption">Hora</span><div className="check98-time-scroll" role="listbox" aria-label="Hora">{HOURS.map(h=><button type="button" key={h} role="option" aria-selected={hour===h} className={hour===h?'selected':''} onClick={()=>setHour(h)}>{h}{hour===h&&<Check size={12}/>}</button>)}</div></div>
    <span className="check98-time-colon">:</span>
    <div><span className="check98-time-caption">Minuto</span><div className="check98-time-scroll" role="listbox" aria-label="Minuto">{MINUTES.map(m=><button type="button" key={m} role="option" aria-selected={minute===m} className={minute===m?'selected':''} onClick={()=>setMinute(m)}>{m}{minute===m&&<Check size={12}/>}</button>)}</div></div>
   </div>
   <div className="check98-time-actions"><button type="button" className="clear" onClick={()=>{onChange('');setDraft('');setInvalid(false);setOpen(false);input.current?.focus()}}>Sem horário</button><button type="button" className="apply" onClick={apply}>Confirmar {hour}:{minute}</button></div>
  </div>}
 </div>;
}