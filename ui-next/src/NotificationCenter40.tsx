import React,{useEffect,useRef,useState} from 'react';
import {Bell,BellOff,Check,CheckCheck,ClipboardList,Clock3,RefreshCw,Repeat2,ShieldCheck,AlertTriangle} from 'lucide-react';
import './notifications40.css';

export type MOPNotice={key:string;title?:string;message?:string;description?:string;detail?:string;type?:string;read?:boolean;at?:string;active?:boolean};
type Filter='all'|'unread'|'read';
type Props={notices:MOPNotice[];error:string;onRead:(key?:string)=>Promise<void>;onRefresh:()=>Promise<void>};
function relativeTime(at?:string){if(!at)return '';const date=new Date(at);if(!Number.isFinite(+date))return '';const diff=Math.max(0,Date.now()-+date);if(diff<60000)return 'Agora';if(diff<3600000)return 'Há '+Math.floor(diff/60000)+' min';if(diff<86400000)return 'Há '+Math.floor(diff/3600000)+' h';return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',timeZone:'America/Sao_Paulo'}).format(date);}
function kindOf(n:MOPNotice){const source=(n.type||'')+' '+(n.title||'');if(/turno|aceite|handover|shift/i.test(source))return 'shift';if(/urgente|prazo|alerta|critico|crítico|alta|sla|atras/i.test(source))return 'alert';if(/checklist|rotina|tarefa/i.test(source))return 'routine';return 'general';}
const tabs:[Filter,string][]=[['all','Todas'],['unread','Não lidas'],['read','Lidas']];
export default function NotificationCenter40({notices,error,onRead,onRefresh}:Props){
 const [open,setOpen]=useState(false),[filter,setFilter]=useState<Filter>('all'),[saving,setSaving]=useState(false);
 const root=useRef<HTMLDivElement>(null),closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const unread=notices.filter(n=>!n.read).length;
 const items=notices.filter(n=>filter==='all'||(filter==='unread'?!n.read:!!n.read));
 const cancel=()=>{if(closeTimer.current){clearTimeout(closeTimer.current);closeTimer.current=null}};
 const show=()=>{cancel();if(!open){setOpen(true);void onRefresh()}};
 const schedule=()=>{cancel();closeTimer.current=setTimeout(()=>setOpen(false),260)};
 useEffect(()=>{const outside=(e:MouseEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};document.addEventListener('mousedown',outside);document.addEventListener('keydown',key);return()=>{document.removeEventListener('mousedown',outside);document.removeEventListener('keydown',key);cancel()}},[]);
 const mark=async(key?:string)=>{if(saving)return;setSaving(true);try{await onRead(key)}finally{setSaving(false)}};
 return <div ref={root} className={'mop-notification-root'+(open?' is-open':'')} onMouseEnter={show} onMouseLeave={schedule} onFocusCapture={show} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))schedule()}}>
  <button type="button" className="ref-notifications mop-notification-trigger" aria-label={'Notificações'+(unread?' ('+unread+' não lidas)':'')} aria-expanded={open} aria-controls="mop-notification-panel" onClick={show} title="Notificações">
   <Bell size={21} strokeWidth={1.9}/>{unread>0&&<span className="mop-notification-count">{unread>99?'99+':unread}</span>}
  </button>
  {open&&<section id="mop-notification-panel" role="dialog" aria-modal="false" aria-label="Central de notificações" className="mop-notification-popover">
   <div className="mop-notification-heading"><div className="mop-notification-heading-icon"><Bell size={21}/></div><div><strong>Notificações</strong><p>{unread?unread+' '+(unread===1?'notificação não lida':'notificações não lidas'):'Tudo em dia por aqui'}</p></div><button type="button" className="mop-notification-refresh" title="Atualizar notificações" aria-label="Atualizar notificações" onClick={()=>void onRefresh()}><RefreshCw size={17}/></button></div>
   <div className="mop-notification-tabs" role="group" aria-label="Filtrar notificações">{tabs.map(([key,label])=><button key={key} type="button" className={filter===key?'selected':''} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}{key!=='read'&&<span>{key==='all'?notices.length:unread}</span>}</button>)}</div>
   {error&&<p className="mop-notification-error" role="alert">{error}</p>}
   <div className="mop-notification-items" role="list">
    {items.length===0?<div className="mop-notification-empty"><BellOff size={28}/><strong>{filter==='unread'?'Nenhuma notificação pendente':filter==='read'?'Nenhuma notificação lida':'Nenhuma notificação no momento'}</strong><span>{filter==='unread'?'Você está em dia com os avisos.':'Os alertas da sua sessão aparecem aqui.'}</span></div>
    :items.map(n=>{const tone=kindOf(n),Icon=tone==='shift'?Repeat2:tone==='alert'?AlertTriangle:tone==='routine'?ClipboardList:ShieldCheck;return <article role="listitem" key={n.key} className={'mop-notification-item '+tone+(n.read?' is-read':' is-unread')}>
      <span className="mop-notification-item-icon"><Icon size={19}/></span><div className="mop-notification-item-body"><strong>{n.title||n.type||'Aviso operacional'}</strong><p>{n.detail||n.message||n.description||'Verifique este evento na central operacional.'}</p><span className="mop-notification-item-time"><Clock3 size={12}/>{relativeTime(n.at)||(n.read?'Visualizada':'Novo aviso')}</span></div>
      {!n.read?<button type="button" className="mop-notification-item-read" disabled={saving} title="Marcar como lida" aria-label={'Marcar como lida: '+(n.title||'aviso')} onClick={()=>void mark(n.key)}><Check size={16}/></button>:<Check size={15} className="mop-notification-read-icon" aria-label="Lida"/>}
     </article>})}
   </div>
   <div className="mop-notification-footer"><button type="button" className="mop-notification-readall" disabled={!unread||saving} onClick={()=>void mark()}><CheckCheck size={18}/>{saving?'Atualizando...':unread?'Marcar todas como lidas':'Todas as notificações lidas'}</button><span className="mop-notification-footnote"><ShieldCheck size={13}/> Alertas da sua sessão</span></div>
  </section>}
 </div>;
}
