import React,{useEffect,useRef,useState} from 'react';
import {ChevronDown,type LucideIcon} from 'lucide-react';
import './record-filter-dropdown.css';
type Props={label:string;value:string;options:readonly string[];onChange:(value:string)=>void;icon?:LucideIcon;display?:(value:string)=>string;placeholder?:string;required?:boolean;id?:string;excludePlaceholder?:boolean;defaultValue?:string;hideSelectedOption?:boolean;disabled?:boolean};
export default function RecordFilterDropdown({label,value,options,onChange,icon:Icon,display,placeholder,required,id,excludePlaceholder=false,defaultValue,hideSelectedOption=false,disabled=false}:Props){
 const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(disabled)setOpen(false)},[disabled]);
 // A query-wide reset belongs in the trigger/clear-filters action, not in the opened list.
 const placeholderValues=new Set([placeholder,label,'Todos os períodos','Todas as categorias','Todos os status','Selecione o condomínio']);
 const listOptions=(excludePlaceholder?options.filter(x=>!!x.trim()&&!placeholderValues.has(x)):options).filter(x=>!(hideSelectedOption&&x===value));
 useEffect(()=>{if(!open)return;const onPointer=(e:PointerEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setOpen(false)};const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();setOpen(false);trigger.current?.focus()}};document.addEventListener('pointerdown',onPointer);document.addEventListener('keydown',onKey,true);return()=>{document.removeEventListener('pointerdown',onPointer);document.removeEventListener('keydown',onKey,true)}},[open]);
 return <div className={'record-filter-dropdown'+(open&&!disabled?' is-open':'')+(Icon?'':' without-icon')} ref={root}>
  <button id={id} ref={trigger} className="record-filter-trigger" type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open&&!disabled} aria-required={required} disabled={disabled} onClick={()=>{if(!disabled)setOpen(x=>!x)}}>{Icon&&<Icon size={18}/>}<span>{value?(display?display(value):value):(placeholder||label)}</span><ChevronDown className="record-filter-chevron" size={16}/></button>
  {open&&!disabled&&<div className="record-filter-menu" role="listbox" aria-label={label}>{listOptions.map(option=><button key={option} type="button" role="option" aria-selected={value===option} className={'record-filter-option'+(value===option?' selected':'')} onClick={()=>{onChange(option);setOpen(false);trigger.current?.focus()}}>{display?display(option):option}{value===option&&<span aria-hidden="true">✓</span>}</button>)}</div>}
 </div>
}
