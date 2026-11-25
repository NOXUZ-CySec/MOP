import React,{useEffect,useState} from 'react';
import {ChevronDown,RefreshCw,ShieldCheck} from 'lucide-react';
import './updater71.css';
type Status={state:string;version?:string;percent?:number;message?:string};
type Note={version:string;date:string;title:string;changes:string[]};
export default function Updater71(){
 const [status,setStatus]=useState<Status>({state:'idle',message:'Verificando atualizações do MOP.'});
 const [notes,setNotes]=useState<Note[]>([]);
 const [busy,setBusy]=useState(false);
 const [confirmRestart,setConfirmRestart]=useState(false);
 const api=window.mopDesktop;
 useEffect(()=>{let active=true;api?.update?.('status').then((s:Status)=>{if(active)setStatus(s)}).catch(()=>{});api?.updateNotes?.().then((list:Note[])=>{if(active)setNotes(list)}).catch(()=>{});const off=api?.onUpdate?.((s:Status)=>{if(active)setStatus(s)});return()=>{active=false;off?.()}},[]);
 const check=async()=>{setBusy(true);try{setStatus(await api!.update!('check'))}catch(e){setStatus({state:'error',message:String(e)})}finally{setBusy(false)}};
 const install=async()=>{setConfirmRestart(false);setStatus(prev=>({...prev,state:'installing',message:'Preparando atualização silenciosa. O MOP será encerrado e reaberto automaticamente.'}));setBusy(true);try{await api!.update!('install')}catch(e){setBusy(false);setStatus({state:'error',message:String(e)})}};
 const askInstall=()=>setConfirmRestart(true);
 useEffect(()=>{if(!confirmRestart)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setConfirmRestart(false)};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[confirmRestart]);
 return <><section className="mop-update74" aria-label="Atualizações e histórico do MOP">
  <div className="mop-updater71"><div><strong>Atualizações do MOP</strong><p aria-live="polite">{status.message||'Consulte novas versões publicadas no GitHub.'}</p>{status.state==='downloading'&&<progress max={100} value={status.percent||0} aria-label="Progresso do download"/>}{status.state==='installing'&&<p>Não desligue o computador. O Windows poderá solicitar permissão de administrador.</p>}</div><div className="mop-updater71-actions"><button type="button" disabled={busy||['checking','downloading','installing'].includes(status.state)} onClick={status.state==='ready'?askInstall:check}>{status.state==='installing'?'Preparando…':status.state==='ready'?'Atualizar e reiniciar':status.state==='downloading'?'Baixando…':'Atualizar'}</button>{status.state==='ready'&&<span>Você pode adiar e continuar trabalhando.</span>}</div></div>
  <section className="mop-release-notes"><div className="mop-release-notes-head"><h3>Notas de atualização</h3><p>Histórico das alterações incluídas em cada versão. Confira antes de atualizar.</p></div>{notes.length?notes.map((note,i)=><details key={note.version} className="mop-release-entry" open={i===0}><summary><span><strong>{note.title}</strong><small>{note.version} · {note.date.split('-').reverse().join('/')}</small></span><ChevronDown className="mop-release-chevron" size={17} strokeWidth={2}/></summary><div className="mop-release-content"><ul>{note.changes.map((change,j)=><li key={j}>{change}</li>)}</ul></div></details>):<p className="mop-release-empty">Notas indisponíveis nesta instalação.</p>}</section>
 </section>
 {confirmRestart&&<div className="mop-update75-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setConfirmRestart(false)}}><div className="mop-update75-dialog" role="alertdialog" aria-modal="true" aria-labelledby="mop-update75-title" aria-describedby="mop-update75-desc"><div className="mop-update75-icon"><RefreshCw size={24}/></div><h3 id="mop-update75-title">Atualizar e reiniciar o MOP?</h3><p id="mop-update75-desc">A versão {status.version||'mais recente'} será instalada silenciosamente. O MOP será fechado e reaberto automaticamente.</p><div className="mop-update75-notice"><ShieldCheck size={17}/><span>Salve suas alterações e finalize qualquer operação em andamento antes de continuar.</span></div><div className="mop-update75-buttons"><button type="button" className="mop-update75-cancel" onClick={()=>setConfirmRestart(false)}>Cancelar</button><button type="button" className="mop-update75-confirm" onClick={install}>Confirmar atualização</button></div></div></div>}
 </>
}
