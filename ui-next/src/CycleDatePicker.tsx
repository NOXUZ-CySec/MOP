import React,{useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
import './cycle-date-picker.css';

type Props={value:string;onChange:(date:string)=>void};
const two=(n:number)=>String(n).padStart(2,'0');
const iso=(year:number,month:number,day:number)=>`${year}-${two(month+1)}-${two(day)}`;
const parse=(value:string)=>{const [y,m,d]=value.split('-').map(Number);return y&&m&&d?new Date(Date.UTC(y,m-1,d)):new Date()};
const display=(value:string)=>value?value.split('-').reverse().join('/'):'Selecione a data';
export default function CycleDatePicker({value,onChange}:Props){
 const [open,setOpen]=useState(false);
 const [view,setView]=useState(()=>{const d=parse(value);return [d.getUTCFullYear(),d.getUTCMonth()] as [number,number]});
 const root=useRef<HTMLDivElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;const selected=parse(value);setView([selected.getUTCFullYear(),selected.getUTCMonth()])},[open,value]);
 useEffect(()=>{if(!open)return;const pointer=(e:PointerEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setOpen(false)};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus()}};document.addEventListener('pointerdown',pointer);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',pointer);document.removeEventListener('keydown',key)}},[open]);
 const [year,month]=view;
 const today=new Date();
 const todayISO=iso(today.getFullYear(),today.getMonth(),today.getDate());
 const firstWeekday=new Date(Date.UTC(year,month,1)).getUTCDay();
 const count=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 const cells=useMemo(()=>[...Array.from({length:firstWeekday},()=>null),...Array.from({length:count},(_,i)=>i+1)],[firstWeekday,count]);
 const navigate=(offset:number)=>{const d=new Date(Date.UTC(year,month+offset,1));setView([d.getUTCFullYear(),d.getUTCMonth()])};
 const pick=(date:string)=>{onChange(date);setOpen(false);trigger.current?.focus()};
 return <div className={'mop-cycle-date'+(open?' is-open':'')} ref={root}>
  <button ref={trigger} type="button" className="mop-cycle-date-trigger" aria-label="Selecionar início do ciclo" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
   <span className="mop-cycle-date-value">{display(value)}</span><CalendarDays size={17} aria-hidden="true"/>
  </button>
  {open&&<div className="mop-cycle-date-popover" role="dialog" aria-label="Calendário do início do ciclo">
   <div className="mop-cycle-date-header"><button type="button" aria-label="Mês anterior" onClick={()=>navigate(-1)}><ChevronLeft size={17}/></button><strong>{new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month,1)))}</strong><button type="button" aria-label="Próximo mês" onClick={()=>navigate(1)}><ChevronRight size={17}/></button></div>
   <div className="mop-cycle-date-weekdays">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=><span key={d}>{d}</span>)}</div>
   <div className="mop-cycle-date-days">{cells.map((day,i)=>day===null?<span key={'empty-'+i}/>:<button type="button" key={day} aria-label={new Intl.DateTimeFormat('pt-BR',{dateStyle:'full',timeZone:'UTC'}).format(new Date(Date.UTC(year,month,day)))} aria-pressed={iso(year,month,day)===value} className={(iso(year,month,day)===value?' selected':'')+(iso(year,month,day)===todayISO?' today':'')} onClick={()=>pick(iso(year,month,day))}>{day}</button>)}</div>
   <div className="mop-cycle-date-footer"><button type="button" onClick={()=>{const d=parse(value);setView([d.getUTCFullYear(),d.getUTCMonth()])}}>Data selecionada</button><button type="button" onClick={()=>pick(todayISO)}>Hoje</button></div>
  </div>}
 </div>
}
