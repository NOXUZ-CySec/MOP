import React,{useEffect,useMemo,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,Check} from 'lucide-react';
import './swap-calendar109.css';
const pad=(n:number)=>String(n).padStart(2,'0');
const iso=(y:number,m:number,d:number)=>`${y}-${pad(m+1)}-${pad(d)}`;
type Props={value:string;onChange:(date:string)=>void;minDate:string;excludeDate?:string};
export default function SwapCalendar109({value,onChange,minDate,excludeDate}:Props){
 const date=value||minDate;const initial=new Date(date+'T12:00:00Z');
 const [yearMonth,setYearMonth]=useState<[number,number]>([initial.getUTCFullYear(),initial.getUTCMonth()]);
 useEffect(()=>{if(!value)return;const d=new Date(value+'T12:00:00Z');if(!Number.isNaN(d.getTime()))setYearMonth([d.getUTCFullYear(),d.getUTCMonth()])},[value]);
 const [year,month]=yearMonth;
 const offset=new Date(Date.UTC(year,month,1)).getUTCDay();
 const count=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 const dates=useMemo(()=>Array.from({length:count},(_,i)=>iso(year,month,i+1)),[year,month,count]);
 const navigate=(delta:number)=>{const d=new Date(Date.UTC(year,month+delta,1));setYearMonth([d.getUTCFullYear(),d.getUTCMonth()])};
 return <section className="scale109-swap-calendar" aria-label="Calendário de escolha do plantão do colega">
  <div className="scale109-swap-top"><div><CalendarDays size={17}/><strong>Selecione a data do plantão</strong></div><div className="scale109-swap-month"><button type="button" aria-label="Mês anterior" onClick={()=>navigate(-1)}><ChevronLeft size={17}/></button><span>{new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month,1)))}</span><button type="button" aria-label="Próximo mês" onClick={()=>navigate(1)}><ChevronRight size={17}/></button></div></div>
  <div className="scale-calendar-grid scale70-grid scale109-swap-grid">
  {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=><span className="scale-weekday" key={d}>{d}</span>)}
  {Array.from({length:offset},(_,i)=><span key={'spacer-'+i} aria-hidden="true"/>)}
  {dates.map(d=>{const blocked=d<minDate||d===excludeDate,chosen=d===value;return <button type="button" key={d} className={'scale-day'+(chosen?' scale70-selected':'')+(blocked?' scale109-swap-disabled':'')} disabled={blocked} aria-label={d.split('-').reverse().join('/')+(blocked?' indisponível':'')} aria-pressed={chosen} onClick={()=>onChange(d)}><span className="scale-day-head"><strong>{Number(d.slice(-2))}</strong>{chosen&&<Check size={14}/>}</span><span className="scale-day-content"><span className="scale-day-main">{chosen?'Selecionado':blocked?'Indisponível':'Disponível'}</span></span></button>})}
  </div>
  <p className="scale109-swap-help">{value?'Data escolhida: '+value.split('-').reverse().join('/'):'Escolha uma data válida no calendário.'} A data do seu plantão não pode ser selecionada novamente.</p>
 </section>;
}
