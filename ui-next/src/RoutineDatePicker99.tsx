import React,{useEffect,useRef,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
import './routine-date-picker99.css';
type Props={value:string;onChange:(value:string)=>void;disabled?:boolean};
const iso=(y:number,m:number,d:number)=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const parse=(value:string)=>{const [y,m,d]=value.split('-').map(Number);return y&&m&&d?new Date(Date.UTC(y,m-1,d)):new Date()};
export default function RoutineDatePicker99({value,onChange,disabled=false}:Props){
 const [open,setOpen]=useState(false),[view,setView]=useState(()=>{const d=parse(value);return [d.getUTCFullYear(),d.getUTCMonth()] as [number,number]});
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(open){const d=parse(value);setView([d.getUTCFullYear(),d.getUTCMonth()])}},[open,value]);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setOpen(false)};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus()}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}},[open]);
 const [y,m]=view;const offset=new Date(Date.UTC(y,m,1)).getUTCDay(),days=new Date(Date.UTC(y,m+1,0)).getUTCDate();
 const today=new Date(),todayValue=iso(today.getFullYear(),today.getMonth(),today.getDate());
 const navigate=(delta:number)=>{const next=new Date(Date.UTC(y,m+delta,1));setView([next.getUTCFullYear(),next.getUTCMonth()])};
 const pick=(next:string)=>{onChange(next);setOpen(false);trigger.current?.focus()};
 return <div className={'routine99-date'+(open?' open':'')} ref={root}>
  <button ref={trigger} type="button" className="routine99-date-trigger" disabled={disabled} aria-label="Selecionar data da rotina" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(x=>!x)}><span>{value?value.split('-').reverse().join('/'):'Selecionar data'}</span><CalendarDays size={16}/></button>
  {open&&<div className="routine99-date-popup" role="dialog" aria-label="Calendário da rotina">
   <div className="routine99-date-header"><button type="button" aria-label="Mês anterior" onClick={()=>navigate(-1)}><ChevronLeft size={16}/></button><strong>{new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m,1)))}</strong><button type="button" aria-label="Próximo mês" onClick={()=>navigate(1)}><ChevronRight size={16}/></button></div>
   <div className="routine99-date-weekdays">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=><span key={d}>{d}</span>)}</div>
   <div className="routine99-date-grid">{Array.from({length:offset},(_,i)=><span key={'blank'+i}/>)}
   {Array.from({length:days},(_,i)=>{const date=iso(y,m,i+1);return <button key={date} type="button" className={(date===value?' selected':'')+(date===todayValue?' today':'')} aria-pressed={date===value} onClick={()=>pick(date)}>{i+1}</button>})}</div>
   <div className="routine99-date-footer"><button type="button" onClick={()=>pick(todayValue)}>Hoje</button><button type="button" onClick={()=>setOpen(false)}>Fechar</button></div>
  </div>}
 </div>;
}