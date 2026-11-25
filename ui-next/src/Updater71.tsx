import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowDownToLine, CalendarDays, Check, CheckCircle2, ChevronDown, Clock3, History, LoaderCircle, PackageCheck, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { appVersion1098, previewLabel1098 } from './version1098';
import './updater71.css';

type Status = {state:string;version?:string;percent?:number;message?:string};
type Note = {version:string;date:string;title:string;changes:string[]};
type Operation = 'check'|'install'|null;
const activeStates = new Set(['loading','checking','available','downloading','installing']);
const targetStates = new Set(['available','downloading','ready','installing']);
const terminalStates = new Set(['current','ready','error','dev','unavailable']);
const presentation:Record<string,{title:string;label:string;tone:string;icon:typeof RefreshCw}> = {
  loading:{title:'Preparando a consulta',label:'Carregando',tone:'neutral',icon:LoaderCircle},
  idle:{title:'Tudo pronto para verificar',label:'Pronto para consultar',tone:'neutral',icon:RefreshCw},
  checking:{title:'Buscando novas versões',label:'Verificando',tone:'active',icon:RefreshCw},
  available:{title:'Nova versão encontrada',label:'Preparando download',tone:'active',icon:ArrowDownToLine},
  downloading:{title:'Baixando a atualização',label:'Download em andamento',tone:'active',icon:ArrowDownToLine},
  current:{title:'Seu MOP está atualizado',label:'Atualizado',tone:'success',icon:CheckCircle2},
  ready:{title:'Pronta para instalar',label:'Atualização disponível',tone:'success',icon:PackageCheck},
  installing:{title:'Preparando o reinício',label:'Instalando',tone:'active',icon:RefreshCw},
  error:{title:'Não foi possível concluir',label:'Requer atenção',tone:'error',icon:AlertCircle},
  dev:{title:'Atualização manual',label:'Versão instalada necessária',tone:'neutral',icon:PackageCheck},
  unavailable:{title:'Atualização indisponível',label:'Abra pelo aplicativo',tone:'neutral',icon:PackageCheck},
};
const versionName=(version:string)=>version.includes('-preview.')?'Preview '+version.split('-preview.')[1]:version;
const noteTitle=(title:string)=>{
  const short=title.replace(/^MOP(?:\s+Preview[\s.]+[\d.]+)?\s*[—–-]\s*/i,'');
  return short.charAt(0).toUpperCase()+short.slice(1);
};
const noteDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)?value.split('-').reverse().join('/'):value;

export default function Updater71(){
  const api=window.mopDesktop;
  const [status,setStatus]=useState<Status>({state:'loading',message:'Consultando o estado das atualizações.'});
  const [operation,setOperation]=useState<Operation>(null);
  const [notes,setNotes]=useState<Note[]>([]);
  const [notesState,setNotesState]=useState<'loading'|'ready'|'error'>('loading');
  const [confirmRestart,setConfirmRestart]=useState(false);
  const alive=useRef(false),eventRevision=useRef(0),requestId=useRef(0),notesRequestId=useRef(0);
  const inFlight=useRef<Operation>(null),statusRef=useRef(status),restartTrigger=useRef<HTMLButtonElement>(null);
  const applyStatus=(next:Status)=>{
    statusRef.current=next;setStatus(next);
    if(terminalStates.has(next.state)){inFlight.current=null;setOperation(null)}
    if(next.state!=='ready')setConfirmRestart(false);
  };
  const loadNotes=async()=>{
    const id=++notesRequestId.current;
    setNotesState('loading');
    try{
      if(!api?.updateNotes)throw Error('Histórico indisponível nesta execução.');
      const list:Note[]=await api.updateNotes();
      if(!alive.current||id!==notesRequestId.current)return;
      setNotes(Array.isArray(list)?list.filter(note=>typeof note?.version==='string'&&typeof note.title==='string'&&typeof note.date==='string'&&Array.isArray(note.changes)):[]);
      setNotesState('ready');
    }catch{if(alive.current&&id===notesRequestId.current)setNotesState('error')}
  };
  useEffect(()=>{
    alive.current=true;
    const revision=eventRevision.current;
    if(api?.update){
      void api.update('status').then((next:Status)=>{
        if(alive.current&&eventRevision.current===revision)applyStatus(next);
      }).catch(error=>{
        if(alive.current&&eventRevision.current===revision)applyStatus({state:'error',message:error instanceof Error?error.message:'Não foi possível consultar o estado da atualização.'});
      });
    }else applyStatus({state:'unavailable',message:'Abra a versão instalada do MOP para consultar e instalar atualizações.'});
    void loadNotes();
    const off=api?.onUpdate?.((next:Status)=>{
      if(!alive.current)return;
      eventRevision.current++;applyStatus(next);
    });
    return()=>{alive.current=false;eventRevision.current++;requestId.current++;notesRequestId.current++;off?.()};
  },[]);

  const check=async()=>{
    if(!api?.update||inFlight.current||activeStates.has(statusRef.current.state))return;
    const id=++requestId.current,revision=eventRevision.current;
    inFlight.current='check';setOperation('check');
    applyStatus({state:'checking',message:'Verificando novas versões no canal de homologação.'});
    try{
      const next:Status=await api.update('check');
      if(alive.current&&id===requestId.current&&revision===eventRevision.current)applyStatus(next);
    }catch(error){
      if(alive.current&&id===requestId.current&&!targetStates.has(statusRef.current.state)){
        applyStatus({state:'error',message:error instanceof Error?error.message:'Não foi possível verificar atualizações. Tente novamente.'});
      }
    }finally{
      if(alive.current&&id===requestId.current&&inFlight.current==='check'){inFlight.current=null;setOperation(null)}
    }
  };
  const install=async()=>{
    if(!api?.update||inFlight.current||statusRef.current.state!=='ready')return;
    const id=++requestId.current;
    inFlight.current='install';setOperation('install');setConfirmRestart(false);
    applyStatus({...statusRef.current,state:'installing',message:'O MOP será encerrado para instalar a atualização e reaberto automaticamente.'});
    try{await api.update('install')}
    catch(error){
      if(alive.current&&id===requestId.current)applyStatus({state:'error',message:error instanceof Error?error.message:'Não foi possível iniciar a instalação. Tente novamente.'});
    }
    // Success returns true before the process exits. A later error event unlocks the UI.
  };

  const view=presentation[status.state]||presentation.idle,StatusIcon=view.icon;
  const blocked=!!operation||activeStates.has(status.state)||status.state==='dev'||status.state==='unavailable'||!api?.update;
  const percent=Number.isFinite(status.percent)?Math.max(0,Math.min(100,Math.round(status.percent!))):0;
  const target=targetStates.has(status.state)&&status.version&&status.version!==appVersion1098?status.version:null;
  const actionLabel=({loading:'Carregando…',checking:'Verificando…',available:'Preparando download…',downloading:'Baixando atualização…',ready:'Atualizar e reiniciar',installing:'Preparando reinício…',error:'Tentar novamente',dev:'Atualização manual',unavailable:'Disponível no aplicativo'} as Record<string,string>)[status.state]||'Verificar atualizações';
  const ActionIcon=status.state==='ready'?RefreshCw:activeStates.has(status.state)?LoaderCircle:RefreshCw;
  return <>
    <section className="mop-update1099" aria-labelledby="mop-update1099-title">
      <header className="mop-update1099-heading">
        <span className="mop-update1099-icon" aria-hidden="true"><RefreshCw size={24}/></span>
        <div><span className="mop-update1099-eyebrow">APLICATIVO · VERSÕES E NOVIDADES</span>
          <h2 id="mop-update1099-title">Atualizações do MOP</h2>
          <p>Acompanhe novas versões e escolha o melhor momento para reiniciar.</p>
        </div>
      </header>
      <div className="mop-update1099-grid">
        <section className="mop-update1099-card mop-update1099-installed" aria-label="Versão instalada">
          <div className="mop-update1099-card-heading"><PackageCheck size={18} aria-hidden="true"/><h3>Versão instalada</h3><span className="mop-update1099-channel">Homologação</span></div>
          <strong className="mop-update1099-version">{previewLabel1098.replace('Preview.','Preview ')}</strong>
          <span className="mop-update1099-version-code">{appVersion1098}</span>
          <p className="mop-update1099-installed-help"><ShieldCheck size={16} aria-hidden="true"/><span>O reinício só acontece após a sua confirmação.</span></p>
        </section>
        <section className={'mop-update1099-card mop-update1099-status tone-'+view.tone} aria-label="Estado da atualização">
          <div className="mop-update1099-status-heading"><span className="mop-update1099-status-icon" aria-hidden="true"><StatusIcon size={19} className={['loading','checking','installing'].includes(status.state)?'mop-update1099-spin':undefined}/></span>
            <div><span className="mop-update1099-state-label">{view.label}</span><h3>{view.title}</h3></div>
          </div>
          <p className="mop-update1099-message" role={status.state==='error'?'alert':'status'}>{status.message||'Consulte novas versões publicadas para o MOP.'}</p>
          {target&&<p className="mop-update1099-target"><Sparkles size={14} aria-hidden="true"/><span>Nova versão</span><strong>{versionName(target)}</strong></p>}
          {status.state==='downloading'&&<div className="mop-update1099-progress"><div><span>Download do pacote</span><strong>{percent}%</strong></div><progress max={100} value={percent} aria-label="Progresso do download"/></div>}
          <Button ref={restartTrigger} className="mop-update1099-primary" disabled={blocked} onClick={()=>status.state==='ready'?setConfirmRestart(true):void check()}>
            <ActionIcon size={17} className={activeStates.has(status.state)?'mop-update1099-spin':undefined} aria-hidden="true"/>{actionLabel}
          </Button>
          <p className="mop-update1099-action-help">{status.state==='ready'?'Você pode continuar trabalhando e instalar quando for conveniente.':status.state==='installing'?'Aguarde a reabertura do aplicativo. Não desligue o computador.':status.state==='dev'||status.state==='unavailable'?'A atualização automática está disponível na versão instalada.':'A busca baixa novas versões automaticamente. Você decide quando reiniciar.'}</p>
        </section>
      </div>
      <section className="mop-update1099-history" aria-labelledby="mop-update1099-history-title">
        <header><div className="mop-update1099-history-heading"><History size={19} aria-hidden="true"/><div><h3 id="mop-update1099-history-title">Histórico de versões</h3><p>Confira as melhorias incluídas em cada atualização.</p></div></div>{notesState==='ready'&&notes.length>0&&<span className="mop-update1099-count">{notes.length} versões</span>}</header>
        {notesState==='loading'?<p className="mop-update1099-empty" role="status"><LoaderCircle size={17} className="mop-update1099-spin" aria-hidden="true"/> Carregando histórico…</p>:notesState==='error'?<div className="mop-update1099-empty" role="status"><AlertCircle size={18} aria-hidden="true"/><span>Não foi possível carregar as notas desta instalação.</span>{api?.updateNotes&&<Button variant="ghost" onClick={()=>void loadNotes()}>Recarregar histórico</Button>}</div>:notes.length===0?<p className="mop-update1099-empty"><History size={18} aria-hidden="true"/> Nenhuma nota de versão disponível nesta instalação.</p>:<div className="mop-update1099-history-list" aria-label="Notas de atualização">
          {notes.map((note,index)=><details key={note.version} className="mop-update1099-release" open={index===0}>
            <summary><span className="mop-update1099-release-icon" aria-hidden="true">{note.version===appVersion1098?<Check size={17}/>:<Clock3 size={17}/>}</span><span className="mop-update1099-release-copy"><strong>{noteTitle(note.title)}</strong><span className="mop-update1099-release-meta"><span>{versionName(note.version)}</span><span className="mop-update1099-release-date"><CalendarDays size={12} aria-hidden="true"/><time dateTime={note.date}>{noteDate(note.date)}</time></span>{note.version===appVersion1098&&<span className="mop-update1099-installed-tag">Instalada</span>}</span></span><ChevronDown className="mop-update1099-chevron" size={17} aria-hidden="true"/></summary>
            <div className="mop-update1099-release-content"><ul>{note.changes.filter(change=>typeof change==='string').map((change,index)=><li key={index}>{change}</li>)}</ul></div>
          </details>)}
        </div>}
      </section>
    </section>
    <AlertDialog open={confirmRestart} onOpenChange={setConfirmRestart}>
      <AlertDialogContent className="mop-shadcn-close mop-update1099-dialog" overlayClassName="mop-shadcn-close-overlay" aria-labelledby="mop-update1099-dialog-title" aria-describedby="mop-update1099-dialog-description"
        onEscapeKeyDown={event=>event.stopPropagation()} onCloseAutoFocus={event=>{event.preventDefault();restartTrigger.current?.focus()}}>
        <AlertDialogHeader>
          <span className="mop-shadcn-close-icon" aria-hidden="true"><RefreshCw size={23}/></span>
          <AlertDialogTitle id="mop-update1099-dialog-title">Atualizar e reiniciar o MOP?</AlertDialogTitle>
          <AlertDialogDescription id="mop-update1099-dialog-description">A versão {versionName(status.version||appVersion1098)} será instalada. O MOP será fechado e reaberto automaticamente.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mop-update1099-dialog-notice"><ShieldCheck size={18} aria-hidden="true"/><span>Salve suas alterações e finalize as operações em andamento antes de continuar.</span></div>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
          <AlertDialogAction type="button" className="mop-update1099-confirm" onClick={()=>void install()}>Confirmar atualização</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
