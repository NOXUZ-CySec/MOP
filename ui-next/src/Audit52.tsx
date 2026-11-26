import { PageHeader, PageAction } from "./PageHeader";
import React,{useEffect,useMemo,useState} from 'react';
import {Search,WifiOff,ArrowLeftRight,CheckCircle2,Clock3} from 'lucide-react';
import RecordFilterDropdown from './RecordFilterDropdown';
type Ack={user_id:string;shift_id:string;snapshot_version:string;record_id:string;record_version:string;ack_at?:string;acknowledged_at?:string;remote_at?:string|null};
type Receipt={id:number;shift_id:string;user_id:string;operator:string;received_at:string;kind:string;delivery_at:string|null;outgoing:string;note:string;source:string};
type History={local:Ack[];remote:Ack[]};
const when=(s?:string)=>{if(!s)return 'Não informado';const d=new Date(s);return Number.isNaN(d.getTime())?'Não informado':d.toLocaleString('pt-BR')};
export default function Audit52({demo}:{demo:boolean}){
 const [data,setData]=useState<History>({local:[],remote:[]}),[receipts,setReceipts]=useState<Receipt[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState(''),[origin,setOrigin]=useState('all');
 const load=async()=>{setBusy(true);setError('');try{
  if(demo){setData({local:[],remote:[]});setReceipts([{id:1,shift_id:'DEMO/Diurno',user_id:'operador.demo',operator:'Operador de demonstração',received_at:new Date().toISOString(),kind:'Início sem entrega anterior',delivery_at:null,outgoing:'',note:'Demonstração sem persistência',source:'demonstração'}]);return}
  const [ack,shift]=await Promise.all([window.mopDesktop?.awareness49?.('history'),window.mopDesktop?.startup108?.('history')]);
  if(!ack||!Array.isArray(shift))throw Error('Histórico operacional indisponível nesta instalação.');
  setData(ack as History);setReceipts(shift as Receipt[]);
 }catch(e){setError(e instanceof Error?e.message:'Não foi possível consultar a auditoria.')}finally{setBusy(false)}};
 useEffect(()=>{void load()},[demo]);
 const matches=(values:unknown[])=>values.some(value=>String(value??'').toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')));
 const list=useMemo(()=>receipts.filter(r=>matches([r.operator,r.user_id,r.shift_id,r.kind,r.outgoing,r.note])),[receipts,query]);
 const ackRows=useMemo(()=>[...data.local.map(x=>({...x,source:'local'})),...data.remote.map(x=>({...x,source:'central'}))].filter(x=>(origin==='all'||x.source===origin)&&matches([x.user_id,x.shift_id,x.record_id,x.snapshot_version])).sort((a,b)=>String(b.ack_at||b.acknowledged_at).localeCompare(String(a.ack_at||a.acknowledged_at))).slice(0,300),[data,query,origin]);
 return <section className="audit52"><PageHeader page="audit" title="Ciência e auditoria" description="Histórico de recebimentos de turno e comprovantes de leitura." actions={
  <PageAction kind="refresh" onClick={()=>void load()} disabled={busy}>{busy?"Atualizando…":"Atualizar"}</PageAction>
 }/>
 {demo&&<p className="audit52-note">Demonstração: registros fictícios; nenhum aceite operacional foi consultado.</p>}
 {error&&<p role="alert" className="audit52-error">{error}</p>}
 <div className="audit52-stats"><div><span>Recebimentos registrados</span><strong>{receipts.length}</strong></div><div><span>Inícios sem entrega</span><strong>{receipts.filter(x=>!x.delivery_at).length}</strong></div><div><span>Ciências individuais antigas</span><strong>{data.local.length+data.remote.length}</strong></div></div>
 <div className="audit52-filters"><label><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar operador, turno ou tipo de recebimento" aria-label="Buscar no histórico"/></label><div className="audit78-origin"><RecordFilterDropdown label="Origem da ciência" placeholder="Origem" defaultValue="all" hideSelectedOption value={origin} options={["all","local","central"]} display={value=>({all:"Todas as origens",local:"Somente local",central:"Somente central"}[value]||value)} onChange={setOrigin}/></div></div>
 <section className="audit107-receipts"><h2><ArrowLeftRight size={19}/> Recebimentos e inícios de turno</h2><div className="audit52-table"><table><thead><tr><th>Operador</th><th>Turno</th><th>Tipo de entrada</th><th>Data e hora</th><th>Operador anterior</th><th>Observação</th></tr></thead><tbody>{list.map(r=><tr key={r.id+'-'+r.user_id+'-'+r.shift_id}><td><strong>{r.operator}</strong></td><td>{r.shift_id}</td><td><span className={'audit107-kind '+(!r.delivery_at?'bootstrap':'')}><CheckCircle2 size={13}/>{r.kind}</span></td><td>{when(r.received_at)}</td><td>{r.outgoing||'Sem entrega anterior'}</td><td>{r.note||'—'}</td></tr>)}</tbody></table>{!list.length&&<p className="audit52-empty">Nenhum recebimento encontrado nesta base com os filtros atuais.</p>}</div></section>
 <section className="audit107-receipts"><h2><Clock3 size={19}/> Histórico de ciências individuais</h2><div className="audit52-table"><table><thead><tr><th>Operador</th><th>Turno</th><th>Ocorrência</th><th>Data e hora</th><th>Origem</th><th>Sincronização</th></tr></thead><tbody>{ackRows.map((x,i)=><tr key={x.source+x.user_id+x.shift_id+x.record_id+x.record_version+i}><td>{x.user_id}</td><td>{x.shift_id}</td><td>{x.record_id}</td><td>{when(x.ack_at||x.acknowledged_at)}</td><td>{x.source==='central'?'Supabase':'Computador'}</td><td>{x.source==='central'||x.remote_at?'Enviado':<span className="audit52-pending"><WifiOff size={13}/> Pendente</span>}</td></tr>)}</tbody></table>{!ackRows.length&&<p className="audit52-empty">Nenhuma ciência individual encontrada nos filtros selecionados.</p>}</div></section>
 <p className="audit52-footnote">Os recebimentos refletem passagens de turno disponíveis na base e no escopo de acesso desta estação. A sincronização com outras máquinas depende da conexão com a central. A lista de ciências individuais permanece separada para preservar o histórico anterior.</p>
 </section>;
}
