import React,{useEffect,useRef,useState} from 'react';
import {Check,ChevronDown,Building2} from 'lucide-react';
import './condo-access-dropdown97.css';

export const MOP_CONDOS=['Barão de Mauá','CEA','Extrema','Gaia Ar','Gaia Terra','Gaia Theia','Jundiai 1','Jundiai 2'] as const;
type Props={value:string[]|null|undefined;disabled?:boolean;onChange:(next:string[]|null)=>void};
export default function CondoAccessDropdown97({value,disabled=false,onChange}:Props){
 const [open,setOpen]=useState(false);
 const ref=useRef<HTMLDivElement>(null);
 const all=value===null;
 const selected=value||[];
 const count=selected.length;
 useEffect(()=>{if(!open)return;const down=(e:PointerEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};document.addEventListener('pointerdown',down);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',down);document.removeEventListener('keydown',key)}},[open]);
 const toggle=(condo:string)=>{if(disabled)return;const next=all?MOP_CONDOS.filter(c=>c!==condo):selected.includes(condo)?selected.filter(c=>c!==condo):[...selected,condo];onChange([...next])};
 return <div className={'mop-condo97'+(open?' is-open':'')} ref={ref}>
  <button type="button" className="mop-condo97-trigger" aria-expanded={open} aria-haspopup="listbox" disabled={disabled} onClick={()=>setOpen(o=>!o)}>
   <Building2 size={17}/><span className="mop-condo97-value">{all?'Todos os condomínios':count?count===1?selected[0]:count+' condomínios selecionados':'Nenhum condomínio autorizado'}</span><ChevronDown size={17} className="mop-condo97-chevron"/>
  </button>
  {open&&<div className="mop-condo97-menu" role="listbox" aria-label="Condomínios autorizados" aria-multiselectable="true">
   <button type="button" role="option" aria-selected={all} className={'mop-condo97-option mop-condo97-all'+(all?' selected':'')} onClick={()=>onChange(all?[]:null)}>
    <span className={'mop-condo97-check'+(all?' checked':'')}>{all&&<Check size={14}/>}</span><span><strong>Todos</strong><small>{all?'Clique para remover todas as autorizações':'Clique para liberar todos os condomínios'}</small></span>
   </button>
   <div className="mop-condo97-separator"/>
   {MOP_CONDOS.map(condo=><button type="button" key={condo} role="option" aria-selected={all||selected.includes(condo)} className={'mop-condo97-option'+(all||selected.includes(condo)?' selected':'')} onClick={()=>toggle(condo)}>
     <span className={'mop-condo97-check'+(all||selected.includes(condo)?' checked':'')}>{(all||selected.includes(condo))&&<Check size={14}/>}</span><span>{condo}</span>
    </button>)}
  </div>}
 </div>;
}
